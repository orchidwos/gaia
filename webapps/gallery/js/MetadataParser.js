'use strict';
/* global
  CONFIG_MAX_IMAGE_PIXEL_SIZE,
  CONFIG_REQUIRED_EXIF_PREVIEW_HEIGHT,
  CONFIG_REQUIRED_EXIF_PREVIEW_WIDTH,
  cropResizeRotate,
  Downsample,
  getImageSize,
  getVideoRotation,
  isPhone,
  parseJPEGMetadata,
  videostorage
*/
/* exported
  metadataParser
*/

//
// This file defines a single metadataParsers object. The two
// properties of this object are metadata parsing functions for image
// files and video files, intended for use with the MediaDB class.
//
// This file depends on JPEGMetadataParser.js and blobview.js
//
var metadataParser = (function() {
  // If we generate our own thumbnails, aim for this size.
  // Calculate needed size from longer side of the screen.
  var THUMBNAIL_WIDTH = computeThumbnailWidth();
  var THUMBNAIL_HEIGHT = THUMBNAIL_WIDTH;

  function computeThumbnailWidth() {
    // Make sure this works regardless of current device orientation
    var portraitWidth = Math.min(window.innerWidth, window.innerHeight);
    var landscapeWidth = Math.max(window.innerWidth, window.innerHeight);
    var thumbnailsPerRowPortrait = isPhone ? 3 : 4;
    var thumbnailsPerRowLandscape = isPhone ? 4 : 6;
    return Math.round(window.devicePixelRatio *
             Math.max(portraitWidth / thumbnailsPerRowPortrait,
                      landscapeWidth / thumbnailsPerRowLandscape));
  }

  var thumbnailSize = {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT
  };

  // Don't try to decode image files of unknown type if bigger than this
  var MAX_UNKNOWN_IMAGE_FILE_SIZE = 0.5 * 1024 * 1024; // half a megabyte

  // If a jpeg does not have a suitable EXIF preview and has more than
  // this number of pixels, then we create an external preview for it
  var MAX_PREVIEWLESS_JPEG_SIZE = 5 * 1024 * 1024; // 5 megapixels

  // An <img> element for loading images
  var offscreenImage = new Image();

  // The screen size. Preview images must be at least this big
  // Note that we use screen.width instead of window.innerWidth because
  // the window size is different when we are invoked for a pick activity
  // (non-fullscreen) and when we are invoked normally (fullscreen).
  var sw = screen.width * window.devicePixelRatio;
  var sh = screen.height * window.devicePixelRatio;

  // Create a thumbnail size canvas, copy the <img> or <video> into it
  // cropping the edges as needed to make it fit, and then extract the
  // thumbnail image as a blob and pass it to the callback.
  // This utility function is used by both the image and video metadata parsers
  function createThumbnailFromElement(elt, video, rotation,
                                      mirrored, callback, error) {
    try {
      // Create a thumbnail image
      var canvas = document.createElement('canvas');
      canvas.width = THUMBNAIL_WIDTH;
      canvas.height = THUMBNAIL_HEIGHT;
      var context = canvas.getContext('2d', { willReadFrequently: true });
      var eltwidth = elt.width;
      var eltheight = elt.height;
      var scalex = canvas.width / eltwidth;
      var scaley = canvas.height / eltheight;

      // Take the larger of the two scales: we crop the image to the thumbnail
      var scale = Math.max(scalex, scaley);

      // Calculate the region of the image that will be copied to the
      // canvas to create the thumbnail
      var w = Math.round(THUMBNAIL_WIDTH / scale);
      var h = Math.round(THUMBNAIL_HEIGHT / scale);
      var x = Math.round((eltwidth - w) / 2);
      var y = Math.round((eltheight - h) / 2);

      var centerX = Math.floor(THUMBNAIL_WIDTH / 2);
      var centerY = Math.floor(THUMBNAIL_HEIGHT / 2);

      // If a orientation is specified, rotate/mirroring the canvas context.
      if (rotation || mirrored) {
        context.save();
        // All transformation are applied to the center of the thumbnail.
        context.translate(centerX, centerY);
      }
      if (mirrored) {
        context.scale(-1, 1);
      }
      if (rotation) {
        switch (rotation) {
        case 90:
          context.rotate(Math.PI / 2);
          break;
        case 180:
          context.rotate(Math.PI);
          break;
        case 270:
          context.rotate(-Math.PI / 2);
          break;
        }
      }

      if (rotation || mirrored) {
        context.translate(-centerX, -centerY);
      }

      // Draw that region of the image into the canvas, scaling it down
      context.drawImage(elt, x, y, w, h,
                        0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

      // Restore the default rotation so the play arrow comes out correctly
      if (rotation || mirrored) {
        context.restore();
      }

      // If this is a video, superimpose a translucent play button over
      // the captured video frame to distinguish it from a still photo thumbnail
      if (video) {
        // First draw a transparent gray circle
        context.fillStyle = 'rgba(0, 0, 0, .2)';
        context.beginPath();
        context.arc(THUMBNAIL_WIDTH / 2, THUMBNAIL_HEIGHT / 2,
                    THUMBNAIL_HEIGHT / 5, 0, 2 * Math.PI, false);
        context.fill();

        // Now outline the circle in white
        context.strokeStyle = 'rgba(255,255,255,.6)';
        context.lineWidth = 2;
        context.stroke();

        // And add a white play arrow.
        context.beginPath();
        context.fillStyle = 'rgba(255,255,255,.6)';
        // The height of an equilateral triangle is sqrt(3)/2 times the side
        var side = THUMBNAIL_HEIGHT / 5;
        var triangle_height = side * Math.sqrt(3) / 2;
        context.moveTo(THUMBNAIL_WIDTH / 2 + triangle_height * 2 / 3,
                       THUMBNAIL_HEIGHT / 2);
        context.lineTo(THUMBNAIL_WIDTH / 2 - triangle_height / 3,
                       THUMBNAIL_HEIGHT / 2 - side / 2);
        context.lineTo(THUMBNAIL_WIDTH / 2 - triangle_height / 3,
                       THUMBNAIL_HEIGHT / 2 + side / 2);
        context.closePath();
        context.fill();
      }

      canvas.toBlob(function(blob) {
        context = null;
        canvas.width = canvas.height = 0;
        canvas = null;
        callback(blob);
      }, 'image/jpeg');
    } catch (ex) {
      // An error may be thrown when the drawImage decodes a broken/trancated
      // image.
      // The elt may be a offscreen image. So, the image metadata is parsed, and
      // the image data is loaded but not decoded. The drawImage triggers the
      // image decoder to decode the image data. And an error may be thrown.
      error('createThumbnailFromElement:' + ex.message);
    }
  }

  var VIDEOFILE = /DCIM\/\d{3}MZLLA\/VID_\d{4}\.jpg/;

  function metadataParser(file, metadataCallback, metadataError, bigFile) {
    // If the file is a poster image for a video file, then we've want
    // video metadata, not image metadata
    if (VIDEOFILE.test(file.name)) {
      videoMetadataParser(file, metadataCallback, metadataError);
      return;
    }

    // Figure out how big the image is if we can. For JPEG files this
    // calls the JPEG parser and returns the EXIF preview if there is one.
    getImageSize(file, gotImageSize, gotImageSizeError);

    function gotImageSizeError(errmsg) {
      // The image is not a JPEG, PNG, GIF or BMP file. We may still be
      // able to decode and display it but we don't know the image
      // size, so we won't even try if the file is too big.
      if (file.size > MAX_UNKNOWN_IMAGE_FILE_SIZE) {
        metadataError('Ignoring large file ' + file.name);
        return;
      }

      // If the file is too small to be an image, ignore it
      if (file.size < 32) {
        metadataError('Ignoring small file ' + file.name);
        return;
      }

      // If the error message is anything other than unknown image type
      // it means we've got a corrupt image file, or the image metdata parser
      // can't handle the file for some reason. Log a warning but keep going
      // in case the image is good and the metadata parser is buggy.
      if (errmsg !== 'unknown image type') {
        console.warn('getImageSize', errmsg, file.name);
      }

      // If it is not too big create a preview and thumbnail.
      createThumbnailAndPreview(file,
                                metadataCallback,
                                metadataError,
                                false,
                                bigFile,
                                {});
    }

    function gotImageSize(metadata) {
      //
      // If the image is too big, reject it now so we don't have
      // memory trouble later.
      //
      // CONFIG_MAX_IMAGE_PIXEL_SIZE is maximum image resolution we
      // can handle.  It's from config.js which is generated at build
      // time (see build/application-data.js).
      //
      // For jpeg images we can downsample while decoding which means that
      // we can handle images that are quite a bit larger.
      //
      // getImageSize() distinguishes pjpeg files from jpeg, because
      // progressive jpeg files are quite different than regular jpegs.
      // Not only do pjpegs not benefit from using #-moz-samplesize, they
      // actually require more memory to decode than other images of the same
      // resolution, so we actually need to reduce the image size limit for
      // this image type.
      //
      var imagesizelimit = CONFIG_MAX_IMAGE_PIXEL_SIZE;
      if (metadata.type === 'jpeg') {
        imagesizelimit *= Downsample.MAX_AREA_REDUCTION;
      }
      else if (metadata.type === 'pjpeg') {
        // As a semi-educated guess, we'll say that we can handle pjpegs
        // 2/3rds the size of the largest PNG we can handle.
        imagesizelimit *= 2 / 3;
      }

      //
      // Even if we can downsample an image while decoding it, we still
      // have to read the entire image file. If the file is particularly
      // large we might also have memory problems. (See bug 1008834: a 20mb
      // 80mp jpeg file will cause an OOM on Tarako even though we can
      // decode it at < 2mp). Rather than adding another build-time config
      // variable to specify the maximum file size, however, we'll just
      // base the file size limit on CONFIG_MAX_IMAGE_PIXEL_SIZE.
      // So if that variable is set to 2M, then we might use up to 12Mb of
      // memory. 2 * 2M bytes for the image file and 4 bytes times 2M pixels
      // for the decoded image. A 4mb file size limit should accomodate
      // most JPEG files up to 12 or 16 megapixels.
      //
      // Note that this size limit is just a guess. If we continue to see
      // OOMs with large files then we should change the number 2 below
      // to something smaller.
      //
      var filesizelimit = 2 * CONFIG_MAX_IMAGE_PIXEL_SIZE;

      if (metadata.width * metadata.height > imagesizelimit ||
          file.size > filesizelimit) {
        metadataError('Ignoring high-resolution image ' + file.name);
        return;
      }

      // If the file included a preview image, see if it is big enough
      if (metadata.preview) {
        // Create a blob that is just the preview image
        var previewblob = file.slice(metadata.preview.start,
                                     metadata.preview.end,
                                     'image/jpeg');

        // Check to see if the preview is big enough to use in MediaFrame
        parseJPEGMetadata(previewblob, previewsuccess, previewerror);
      }
      else {
        // If there wasn't a preview image, then generate a preview and
        // thumbnail from the full size image.
        useFullsizeImage();
      }

      function previewerror(msg) {
        // The preview isn't a valid jpeg file, so use the full image to
        // create a preview and a thumbnail
        console.error(msg);
        useFullsizeImage();
      }

      // If we can't find a valid embedded EXIF preview image then we come here
      function useFullsizeImage() {
        // If the full size image is a JPEG then we'll just skip the
        // preview generation because we can downsample and decode it
        // at preview size when needed. So in this case, we just need
        // to create a thumbnail for the image.  On the other hand, if
        // this is not a JPEG image then we have to create both a
        // thumbnail and an external preview image. Note that progressive
        // jpegs will have a type 'pjpeg' and will be handled below
        // like png images.

        // For jpeg images with image sizes more than 5MP, we need
        // to create preview on sdcard to avoid flash while opening image.
        // See bug 1181290.
        // This constraint can be removed when gecko supports downscale during
        // decode by canvas size for offscreen images. This will
        // facilitate removing #moz-sample-size and using ddd.
        // See bug 1206206.

        if (metadata.type === 'jpeg') {
          if (metadata.width * metadata.height <= MAX_PREVIEWLESS_JPEG_SIZE) {
            // If the jpeg image isn't too big we don't need a preview
            // because we can decode it quickly enough at screen size.
            // So in this case we just need to create a thumbnail.
            cropResizeRotate(file, null, thumbnailSize, null, metadata,
                             function gotThumbnail(error, thumbnailBlob) {
                               if (error) {
                                 var msg = 'Failed to create thumbnail for' +
                                   file.name;
                                 console.error(msg);
                                 metadataError(msg);
                                 return;
                               }

                               metadata.preview = null;
                               metadata.thumbnail = thumbnailBlob;
                               metadataCallback(metadata);
                             });
          }
          else {
            // Otherwise, this is a high-resolution jpeg that does not
            // have an EXIF preview big enough for the screen. We need
            // to create both a thumbnail and a preview image but we can
            // do that with efficient downsampling using cropResizeRotate().
            createJPEGThumbnailAndPreview(file, metadata,
                                          metadataCallback,
                                          metadataError);
          }
        }
        else {
          // In this case we have no preview and the image is not a jpeg
          // that can be downsampled with #-moz-samplesize
          createThumbnailAndPreview(file,
                                    metadataCallback,
                                    metadataError,
                                    false,
                                    bigFile,
                                    metadata);
        }
      }

      function previewsuccess(previewmetadata) {
        // Size of the preview image
        var pw = previewmetadata.width;
        var ph = previewmetadata.height;
        // optional configuration specifying minimum size
        var mw = CONFIG_REQUIRED_EXIF_PREVIEW_WIDTH;
        var mh = CONFIG_REQUIRED_EXIF_PREVIEW_HEIGHT;

        var bigenough;

        // If config.js specifies a minimum required preview size,
        // then this preview is big enough if both dimensions are
        // larger than that configured minimum. Otherwise, the preview
        // is big enough if at least one dimension is >= the screen
        // size in both portait and landscape mode.
        if (mw && mh) {
          bigenough =
            Math.max(pw, ph) >= Math.max(mw, mh) &&
            Math.min(pw, ph) >= Math.min(mw, mh);
        }
        else {
          bigenough = (pw >= sw || ph >= sh) && (pw >= sh || ph >= sw);
        }

        // Does the aspect ratio of the preview match the aspect ratio of
        // the full-size image? If not we have to assume it is distorted
        // and should not be used.
        var aspectRatioMatches =
          Math.abs(pw / ph - metadata.width / metadata.height) < 0.01;

        // If the preview is good, use it to create a thumbnail.
        if (bigenough && aspectRatioMatches) {
          metadata.preview.width = pw;
          metadata.preview.height = ph;

          // This is the most common case. We've got a JPEG image with a
          // JPEG preview. All we need is a thumbnail, and we can create that
          // most efficiently with cropResizeRotate which will use
          // #-moz-samplesize to save memory while decoding the image.
          // Note that we apply the EXIF orientation information from
          // the full size image to the preview image.
          previewmetadata.rotation = metadata.rotation;
          previewmetadata.mirrored = metadata.mirrored;
          cropResizeRotate(previewblob, null, thumbnailSize, null,
                           previewmetadata,
                           function gotThumbnailBlob(error, thumbnailBlob) {
                             if (error) {
                               previewerror(error);
                               return;
                             }
                             metadata.thumbnail = thumbnailBlob;
                             metadataCallback(metadata);
                           });
        } else {
          // Preview isn't big enough so get one the hard way
          useFullsizeImage();
        }
      }
    }
  }

  // This function is called for JPEG images that do not have a suitable
  // EXIF preview image and that have more than MAX_PREVIEWLESS_JPEG_SIZE
  // pixels. It creates and saves a preview image and a thumbnail.
  // Unlike createThumbnailAndPreview(), it uses cropResizeRotate() which
  // downsamples jpeg images while decoding them to save memory.
  function createJPEGThumbnailAndPreview(file, metadata,
                                         metadataCallback, metadataError)
  {

    // Figure out the preview size.
    var scale = Math.max(Math.min(sw / metadata.width,
                                  sh / metadata.height, 1),
                         Math.min(sh / metadata.width,
                                  sw / metadata.height, 1));
    var previewSize = {
      width: Math.round(metadata.width * scale),
      height: Math.round(metadata.height * scale)
    };

    // Create a preview image.
    // Note that we can't use the full metadata object here
    // because we don't want the preview image to be rotated.
    // We want the same orientation as the original image
    cropResizeRotate(file, null, previewSize, null,
      { width: metadata.width, height: metadata.height },
      function gotPreview(error, previewBlob) {
        if (error) {
          var msg = 'Failed to create preview for' +
            file.name;
          console.error(msg);
          metadataError(msg);
          return;
        }

        // Save this preview to the sdcard
        savePreview(file, previewBlob, metadataError, function(filename) {
          // Record the preview image in the metadata
          metadata.preview = {
            filename: filename,
            width: previewSize.width,
            height: previewSize.height
          };

          // Now create the thumbnail from this smaller preview image
          // In this case we need to pass the size of the preview
          // and the rotation of the original image.
          cropResizeRotate(previewBlob, null, thumbnailSize, null,
                           {
                             width: previewSize.width,
                             height: previewSize.height,
                             rotation: metadata.rotation
                           },
                           function gotThumbnail(error, thumbnailBlob) {
                             // If thumbnail creation failed report the error
                             if (error) {
                               metadataError(error);
                               return;
                             }

                             // Otherwise, remember thumbnail and we're done
                             metadata.thumbnail = thumbnailBlob;
                             metadataCallback(metadata);
                           });
        });
      });
  }

  // Load an image from a file into an <img> tag, and then use that
  // to get its dimensions and create a thumbnail.  Store these values in
  // a metadata object, and pass the object to the callback function.
  // If anything goes wrong, pass an error message to the error function.
  // If it is a large image, create and save a preview for it as well.
  //
  // We used to call this function for every image. Now that gecko supports
  // the #-moz-samplesize media fragment, however, we handle jpeg images
  // with cropResizeRotate() for memory efficiency, and this function is
  // used only for non-jpeg files.
  function createThumbnailAndPreview(file, callback, error, nopreview,
                                     bigFile, metadata) {
    var url = URL.createObjectURL(file);
    offscreenImage.src = url;

    offscreenImage.onerror = function() {
      URL.revokeObjectURL(url);
      offscreenImage.src = '';
      error('createThumbnailAndPreview: Image failed to load');
    };

    offscreenImage.onload = function() {
      URL.revokeObjectURL(url);

      var iw = offscreenImage.width;
      var ih = offscreenImage.height;

      // Don't overwrite the metadata in the case we read a previewblob.
      if (!nopreview) {
        metadata.width = iw;
        metadata.height = ih;
      }

      // If this is a big image, then decoding it takes a lot of memory.
      // We set this flag to prevent the user from zooming in on other
      // images at the same time because that also takes a lot of memory
      // and we don't want to crash with an OOM. If we find one big image
      // we assume that there may be others, so the flag remains set until
      // the current scan is complete.
      //
      // XXX: When bug 854795 is fixed, we'll be able to create previews
      // for large images without using so much memory, and we can remove
      // this flag then.
      if (iw * ih > 2 * 1024 * 1024 && bigFile) {
        bigFile();
      }

      // If the image was already thumbnail size, it is its own thumbnail
      // and it does not need a preview
      if (metadata.width <= THUMBNAIL_WIDTH &&
          metadata.height <= THUMBNAIL_HEIGHT) {
        offscreenImage.src = '';
        metadata.thumbnail = file;
        callback(metadata);
      }
      else {
        createThumbnailFromElement(
          offscreenImage,
          false,
          metadata.rotation || 0,
          metadata.mirrored || false,
          gotThumbnail,
          error);
      }

      function gotThumbnail(thumbnail) {
        metadata.thumbnail = thumbnail;
        // If no preview was requested, or if if the image was less
        // than half a megapixel then it does not need a preview
        // image, and we can call the callback right away
        if (nopreview || metadata.width * metadata.height < 512 * 1024) {
          offscreenImage.src = '';
          callback(metadata);
        }
        else {
          // Otherwise, this was a big image and we need to create a
          // preview for it so we can avoid decoding the full size
          // image again when possible
          createAndSavePreview();
        }
      }

      function createAndSavePreview() {
        // Figure out the preview size.
        // Make sure the size is big enough for both landscape and portrait
        var scale = Math.max(Math.min(sw / iw, sh / ih, 1),
                             Math.min(sh / iw, sw / ih, 1));
        // preview width and height
        var pw = Math.round(iw * scale);
        var ph = Math.round(ih * scale);

        // Create the preview in a canvas
        var canvas = document.createElement('canvas');
        canvas.width = pw;
        canvas.height = ph;
        var context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(offscreenImage, 0, 0, iw, ih, 0, 0, pw, ph);
        canvas.toBlob(function(blob) {
          offscreenImage.src = '';
          canvas.width = canvas.height = 0;
          savePreview(file, blob, error, function(filename) {
            metadata.preview = {
              filename: filename,
              width: pw,
              height: ph
            };
            callback(metadata);
          });
        }, 'image/jpeg');
      }
    };
  }

  // Given an image file and a preview blob for it, this function saves
  // the preview to a file in .gallery/previews/ and then passes the filename
  // to the specified callback. Calls errorCallback if an error occurs.
  // This is used by createThumbnailAndPreview() and by
  // createJPEGThumbnailAndPreview().
  function savePreview(file, previewblob, errorCallback, filenameCallback) {
    var storage = navigator.b2g.getDeviceStorage('pictures');
    var filename;
    if (file.name[0] === '/') {
      // We expect file.name to be a fully qualified name (perhaps
      // something like /sdcard/DCIM/100MZLLA/IMG_0001.jpg).
      var slashIndex = file.name.indexOf('/', 1);
      if (slashIndex < 0) {
        errorCallback('savePreview: Bad filename: \'' + file.name + '\'');
        return;
      }
      filename =
        file.name.substring(0, slashIndex) + // storageName (i.e. /sdcard)

        '/.gallery/previews' +
        file.name.substring(slashIndex); // rest of path (i,e, /DCIM/...)
    } else {
      // On non-composite storage areas (e.g. desktop), file.name will be
      // a relative path.
      filename = '.gallery/previews/' + file.name;
    }

    // Add a '.jpeg' extension to all preview files. This is necessary
    // because all previews get saved as jpegs even if the original
    // image is not a jpeg. But DeviceStorage uses the filename extension
    // to determine the file type.
    filename += '.jpeg';

    // Delete any existing preview by this name
    var delreq = storage.delete(filename);
    delreq.onsuccess = delreq.onerror = save;

    function save() {
      var savereq = storage.addNamed(previewblob, filename);
      savereq.onerror = function() {
        console.error('Could not save preview image', filename);
      };

      // Don't actually wait for the save to complete.
      filenameCallback(filename);
    }
  }

  function videoMetadataParser(file, metadataCallback, errorCallback) {
    var metadata = {};
    var videofilename = file.name.replace('.jpg', '.3gp');
    metadata.video = videofilename;

    var getreq = videostorage.get(videofilename);
    getreq.onerror = function() {
      errorCallback('cannot get video file: ' + videofilename);
    };
    getreq.onsuccess = function() {
      var videofile = getreq.result;
      getVideoRotation(videofile, function(rotation) {
        if (typeof rotation === 'number') {
          metadata.rotation = rotation;
          getVideoThumbnailAndSize();
        }
        else if (typeof rotation === 'string') {
          errorCallback('Video rotation:', rotation);
        }
      });
    };

    function getVideoThumbnailAndSize() {
      var url = URL.createObjectURL(file);
      offscreenImage.src = url;

      offscreenImage.onerror = function() {
        URL.revokeObjectURL(url);
        offscreenImage.src = '';
        errorCallback('getVideoThumanailAndSize: Image failed to load');
      };

      offscreenImage.onload = function() {
        URL.revokeObjectURL(url);

        // We store the unrotated size of the poster image. The video
        // itself might be larger or smaller than this, but it will
        // have the same orientation and aspect ratio.
        metadata.width = offscreenImage.width;
        metadata.height = offscreenImage.height;

        createThumbnailFromElement(offscreenImage,
                                   true,
                                   metadata.rotation,
                                   false,
                                   function(thumbnail) {
                                     metadata.thumbnail = thumbnail;
                                     offscreenImage.src = '';
                                     metadataCallback(metadata);
                                   },
                                   errorCallback);
      };
    }
  }

  return metadataParser;
}());
