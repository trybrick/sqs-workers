module.exports = {
    exists: function(filePath, isFolder) {
        try {
            var stat = fs.statSync(filePath);
            return isFolder ? stat.isDirectory() : stat.isFile();
        } catch (err) {
            return false;
        }
    }
}