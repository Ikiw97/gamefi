const fs = require('fs');
const path = require('path');

const questPath = path.join(__dirname, 'quest.html');
const cssPath = path.join(__dirname, 'css', 'quest.css');

let html = fs.readFileSync(questPath, 'utf8');

// The CSS is between <style> and </style>
const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>');

if (styleStart !== -1 && styleEnd !== -1) {
    let css = html.substring(styleStart + 7, styleEnd).trim();
    // Replace assets paths in CSS
    css = css.replace(/assets\/sprites\//g, '../assets/sprites/');
    fs.writeFileSync(cssPath, css, 'utf8');
    
    // Replace the style block with the link tag
    const preStyle = html.substring(0, styleStart);
    const postStyle = html.substring(styleEnd + 8);
    
    html = preStyle + '<link rel="stylesheet" href="css/quest.css" />\n' + postStyle;
    console.log('Extracted CSS to css/quest.css');
}

// Write the modified HTML back
fs.writeFileSync(questPath, html, 'utf8');
console.log('Updated quest.html');
