#openstax2canvas
Functional Node wrapper for the open source Canvas LMS REST API. All REST calls are supported via the lower-level

## Implements

* [canvas-lms.js](https://github.com/rockymadden/canvas-lms.js/): Functional Node wrapper for the open source Canvas LMS REST API

## Using
First, create an [API key](https://canvas.instructure.com/doc/api/file.oauth.html#manual-token-generation) on your installation of Canvas under user settings.

Next, create a config folder in the app's root directory and place a file named 'config.js' in that folder. The contents of config should be:

```javascript
var config = {
  canvas_url : "https://example.canvasinstallation.com",
  canvas_api : "YOUR~API~KEY~", // get from canvas user settings
  course_id: '1467136' // id of the course to upload to. Get from url bar
};

module.exports = config;
```

> <sub>__Note:__ Of course, sub in your own installation URL and API key</sub>

Once you have that all configured, download and unzip a textbook from OpenStax. Then, cd to the app's directory and run:

```terminal
node app.js /path/to/unzipped/openstax chapter-range
```

Where chapter-range is the range of chapters you wish to process and have uploaded to your canvas account as module pages in the format "1-32" to do the first 32 chapters, for example.

## License
```
The MIT License (MIT)

Copyright (c) 2016 Kieran Mann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
