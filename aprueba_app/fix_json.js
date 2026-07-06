const fs = require('fs');
const filename = process.argv[2];
if (!filename) {
    console.error("Please provide a filename.");
    process.exit(1);
}

let content = fs.readFileSync(filename, 'utf8');
// First, replace all double backslashes with single to normalize
content = content.replace(/\\\\/g, '\\');
// Then replace all single backslashes with double backslashes
content = content.replace(/\\/g, '\\\\');
// Fix quotes that might have been escaped: \\" -> \"
content = content.replace(/\\\\"/g, '\\"');
// Fix potentially escaped forward slashes: \\/ -> \/
content = content.replace(/\\\\\//g, '\\/');

try {
    JSON.parse(content);
    console.log("JSON is now valid. Saving...");
    fs.writeFileSync(filename, content);
} catch (e) {
    console.error("JSON is still invalid: " + e.message);
    // Print lines around the error
    const match = e.message.match(/at position (\d+)/);
    if (match) {
        const pos = parseInt(match[1]);
        console.error("Around: ", content.substring(Math.max(0, pos - 50), pos + 50));
    }
}
