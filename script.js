import PS1MemCard from './PS1MemCard.js';


function download(content = JSON.stringify({"thing":"thingval"}), fileName = "blob", contentType = "application/binary") {
    let a = document.createElement("a");
    let file = new Blob([content], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

const loadFile = async(event) => {
    const loadfileelement = event.target;
    const fileList = loadfileelement.files;
    for(let i = 0;i<fileList.length;i++){
      try{
        let filearraybuffer = await fileList[i].arrayBuffer();
        let card = new PS1MemCard(filearraybuffer, fileList[i].name);

      }
      catch(error){
        console.log(error.message);
      }
    }
    document.getElementById("viewthem").innerHTML = PS1MemCard.gethtml();
    PS1MemCard.drawimages(0);

    //clear it:
    loadfileelement.value = "";//loadfileelement === document.getElementById("load-file");
    //loadfileelement.HTMLInputElement = ;//?? not needed?
}






function start(){
    const tsvs = PS1MemCard.getreadablelibrary();
    if(tsvs!==""){
      download(tsvs,"PS1SaveInfo.tsv", "text/plain");
    }
}


document.getElementById("rootdiv").innerHTML = `
    <button id='startbutton'>Download</button>
    <input type="file" multiple id="load-file"/>
    <div id="viewthem">nothing.</div>
`;
document.getElementById('load-file').addEventListener('change', async (event) => { await loadFile(event); });
document.getElementById('startbutton').addEventListener('click', async () => { start(); });


