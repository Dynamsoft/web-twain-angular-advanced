var express = require('express');
var fs = require('fs');
var path = require('path');
var app = express();
var uploadDir = path.join(__dirname, 'uploaded');
var tempUploadDir = path.join(__dirname, '.tmp-uploads');

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(tempUploadDir, { recursive: true });
app.use('/uploaded', express.static(uploadDir));
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Credentials", true);
    next();
});

app.post('/upload', async function (req, res) {
    var formidable;
    try {
        formidable = await import('formidable');
    } catch (importErr) {
        console.error('upload parser initialization failed', importErr);
        res.status(500).end('Upload unavailable');
        return;
    }
    var form = new formidable.IncomingForm({ uploadDir: tempUploadDir });
    form.parse(req, function (err, fields, files) {
        if (err) {
            console.error('upload parse failed', err);
            res.status(400).end('Invalid upload');
            return;
        }

        var remoteFiles = files && files.RemoteFile;
        var remoteFile = Array.isArray(remoteFiles) && remoteFiles.length === 1 ? remoteFiles[0] : null;
        if (!remoteFile || typeof remoteFile.filepath !== 'string' || typeof remoteFile.originalFilename !== 'string') {
            res.status(400).end('Missing upload file');
            return;
        }

        var tempPath = path.resolve(remoteFile.filepath);
        var tempRelativePath = path.relative(tempUploadDir, tempPath);
        if (!tempRelativePath || tempRelativePath === '..' ||
            tempRelativePath.indexOf('..' + path.sep) === 0 || path.isAbsolute(tempRelativePath)) {
            res.status(400).end('Invalid upload path');
            return;
        }

        var fileName = remoteFile.originalFilename;
        if (!fileName || fileName === '.' || fileName === '..' ||
            fileName.indexOf('/') !== -1 || fileName.indexOf('\\') !== -1 ||
            fileName.indexOf('\0') !== -1) {
            fs.unlink(tempPath, function (unlinkErr) {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                    console.error('temporary upload cleanup failed', unlinkErr);
                }
            });
            res.status(400).end('Invalid file name');
            return;
        }

        var destinationPath = path.resolve(uploadDir, fileName);
        var destinationRelativePath = path.relative(uploadDir, destinationPath);
        if (!destinationRelativePath || destinationRelativePath === '..' ||
            destinationRelativePath.indexOf('..' + path.sep) === 0 || path.isAbsolute(destinationRelativePath)) {
            res.status(400).end('Invalid file name');
            return;
        }

        fs.readFile(tempPath, function (readErr, data) {
            fs.unlink(tempPath, function (unlinkErr) {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                    console.error('temporary upload cleanup failed', unlinkErr);
                }
            });

            if (readErr) {
                console.error('upload read failed', readErr);
                res.status(500).end('Upload failed');
                return;
            }

            fs.writeFile(destinationPath, data, function (writeErr) {
                if (writeErr) {
                    console.error('upload save failed', writeErr);
                    res.status(500).end('Upload failed');
                    return;
                }
                console.log('file saved');
                res.end();
            });
        });
    });
})

var server = app.listen(process.env.PORT || 2020, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('listening at http://%s:%s', host, port);
})