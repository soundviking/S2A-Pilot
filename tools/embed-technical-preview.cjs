/* Keep the PDF preview in the main application so export needs no late script request. */
const fs=require('node:fs'),path=require('node:path');
module.exports=function(root){
 const file=path.join(root,'app.js'),start='// BEGIN EMBEDDED TECHNICAL PREVIEW',end='// END EMBEDDED TECHNICAL PREVIEW';
 let app=fs.readFileSync(file,'utf8');const from=app.indexOf(start);
 if(from!==-1){const to=app.indexOf(end,from);if(to===-1)throw new Error('Incomplete embedded PDF preview');app=app.slice(0,from)+app.slice(to+end.length);}
 const preview=fs.readFileSync(path.join(root,'technical-preview.js'),'utf8').trim();
 fs.writeFileSync(file,app.trimEnd()+'\n\n'+start+'\n'+preview+'\n'+end+'\n');
};
