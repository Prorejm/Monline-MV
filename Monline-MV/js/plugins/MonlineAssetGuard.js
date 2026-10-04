//=============================================================================
// MonlineAssetGuard.js
//=============================================================================
/*:
 * @plugindesc Gracefully degrade when an asset is missing (VX Ace -> MV port).
 * @author Monline MV port
 *
 * @help
 * A VX Ace -> MV port will always have a few assets that could not be carried
 * over.  Out of the box RPG Maker MV reacts to a missing image/audio file by
 * showing the "Loading Error" screen and calling SceneManager.stop(), which
 * freezes the whole game with a Retry button.  To a player that is
 * indistinguishable from a crash.
 *
 * This plugin removes every fatal path:
 *
 *   1. ResourceHandler.createLoader() is wrapped so that a resource that
 *      ultimately fails never calls Graphics.printLoadingError() nor
 *      SceneManager.stop().  It is logged to the console instead.
 *   2. Bitmap.prototype._onError() turns a failed image into a valid, blank
 *      bitmap and fires its load listeners, so nothing waits forever.
 *   3. AudioManager.checkWebAudioError() no longer throws for a broken buffer;
 *      the missing sound is simply silent.
 *   4. Graphics.printLoadingError() is neutralised as a second line of defence.
 *   5. Bitmap/isReady() also accepts the 'error' state so the image cache
 *      reports itself as settled.
 *
 * Missing assets therefore become "invisible" instead of "fatal".
 */

(function() {
    'use strict';

    var TAG = 'MonlineAssetGuard';
    var missing = [];

    //-------------------------------------------------------------------------
    // 1. A failing resource must never stop the scene
    //-------------------------------------------------------------------------
    var _createLoader = ResourceHandler.createLoader;
    ResourceHandler.createLoader = function(url, retryMethod, resignMethod, retryInterval) {
        var safeResign = function() {
            if (url && missing.indexOf(url) < 0) {
                missing.push(url);
                console.warn(TAG + ': missing resource -> ' + url);
            }
            if (resignMethod) {
                try {
                    resignMethod();
                } catch (e) {
                    console.warn(TAG + ': resign callback failed for ' + url, e);
                }
            }
        };
        // Passing a null url makes the core skip the
        //   Graphics.printLoadingError(url); SceneManager.stop();
        // branch entirely, while retryMethod / resignMethod still run.
        return _createLoader.call(this, null, retryMethod, safeResign, retryInterval);
    };

    /** Console/debug helper: every asset that could not be loaded. */
    ResourceHandler.missingAssets = function() {
        return missing.slice();
    };

    //-------------------------------------------------------------------------
    // 2. A failed image becomes a valid (blank) bitmap
    //-------------------------------------------------------------------------
    Bitmap.prototype._onError = function() {
        try {
            if (this._image) {
                this._image.removeEventListener('load', this._loadListener);
                this._image.removeEventListener('error', this._errorListener);
                this._image.src = '';
            }
        } catch (e) { /* the image may already be gone -- ignore */ }

        // Drop the broken element so the lazy _baseTexture getter falls back
        // to the canvas instead of trying to upload a dead <img>.
        this._image = null;
        this._loadingState = 'loaded';
        this._decodeAfterRequest = true;
        if (!this.__canvas) {
            this._createCanvas(1, 1);
        }
        this._setDirty();
        try {
            this._callLoadListeners();
        } catch (e) {
            console.warn(TAG + ': load listener threw', e);
        }
    };

    //-------------------------------------------------------------------------
    // 3. A broken audio buffer must not throw
    //-------------------------------------------------------------------------
    AudioManager.checkWebAudioError = function(webAudio) {
        if (webAudio && webAudio.isError()) {
            console.warn(TAG + ': missing audio -> ' + webAudio.url);
        }
    };

    //-------------------------------------------------------------------------
    // 4. Second line of defence: never draw the loading-error screen
    //-------------------------------------------------------------------------
    Graphics.printLoadingError = function(url) {
        console.warn(TAG + ': suppressed loading error for ' + url);
    };

    Graphics.eraseLoadingError = function() {
        if (this._errorPrinter && !this._errorShowed) {
            this._errorPrinter.innerHTML = '';
            this.startLoading();
        }
    };

    //-------------------------------------------------------------------------
    // 5. An 'error' bitmap counts as settled for the image cache
    //-------------------------------------------------------------------------
    Bitmap.prototype.isReady = function() {
        return this._loadingState === 'loaded' ||
               this._loadingState === 'none' ||
               this._loadingState === 'error';
    };

})();
