
let tsvthing = "";




class PS1MemCard{

  static #FrameSize = 0x80;
  static #FramesPerBlock = 64;
  static #BlockSize = PS1MemCard.#FrameSize * PS1MemCard.#FramesPerBlock;

  constructor( filearraybuffer, filename = "" ){
    const bytes = filearraybuffer.byteLength;
    const extra = bytes%PS1MemCard.#BlockSize;
    const blockcount = (bytes-extra)/PS1MemCard.#BlockSize;
    
    const extraheader = new Uint8Array(filearraybuffer.slice(0, extra));

    let allblocks = [];
    for(let i = 0;i<blockcount;i++){
      const start = extra+(i*PS1MemCard.#BlockSize);
      allblocks.push( filearraybuffer.slice(start, start+PS1MemCard.#BlockSize) );
    }

    let firstblock = 0;
    this.B0refs = [];
    switch(extra){

      case 3904://0xF40
        this.gmeheader = extraheader;
      case 0:
        if(blockcount===16){//full card
          firstblock = 1;
          let allframes = [];
          for(let i = 0;i<PS1MemCard.#FramesPerBlock;i++){
            const start = i*PS1MemCard.#FrameSize;
            allframes.push( new Uint8Array(allblocks[0].slice(start, start+PS1MemCard.#FrameSize)) );
          }

          const mcframe = new MCFrame(allframes[0]);
          if(!mcframe.IsMCFrame()){
            console.log("First frame is not MC frame!");
          }
          const finalframe = new MCFrame(allframes[PS1MemCard.#FramesPerBlock-1]);
          if(finalframe.IsMCFrame()){
            //console.log("Last frame IS MC frame!");
          }

          const allfileheaders = allframes.slice(1,16);

          //let fileinfos = [];
          allfileheaders.forEach( header => {
            this.B0refs.push(new MCFrame(header));
            //fileinfos.push(this.B0refs[this.B0refs.length-1].getall());
          });
          //console.log(fileinfos);
          
          this.B0refs.forEach( (info, index) => {
            tsvthing = info.addtostringtsv(tsvthing,filename,index);
          });
          //console.log(tsvthing);


          const unavailableframes = allframes.slice(16,36);
          const emptyframes = allframes.slice(36,PS1MemCard.#FramesPerBlock-1);

          unavailableframes.forEach( frame => {
            let mc = new MCFrame(frame);
            //console.log( {unavailableframes:mc.getall()});
          });

          emptyframes.forEach( frame => {
            let mc = new MCFrame(frame);
            //console.log( {emptyframes:mc.getall()});
          });

        } else {
          let filenamearray = new Uint8Array(20);//.fill(0);
          let filenamelength = filename.length;
          if(filenamelength>20){
            filenamelength = 20;
          }
          for(let i = 0;i<filenamelength;i++){
            filenamearray[i] = filename.charCodeAt(i);
          }
          this.B0refs.push( {B0filename:filenamearray} );
        }
      break;

      case 128://mcs - first 128bytes is fat bit - direct mc copy? check!!
      this.B0refs.push(new MCFrame(extraheader));
        //console.log(this.fileinfo.getall());
        //tsvthing = this.fileinfo.addtostringtsv(tsvthing,filename,0);
        //console.log(tsvthing);
      break;

      case 132://psv - first 132bytes is sony?? /signature
        this.sonyheader = extraheader;
        this.vspheader = this.sonyheader.slice(0, 8);
        //more..
        this.headernamearray = this.sonyheader.slice(0x64, 0x64+20);
        this.twelvezeroes = this.sonyheader.slice(0x64+20);//toend

        this.filenamearray = new Uint8Array(20);//.fill(0);
        for(let i = 0;i<12;i++){
          this.filenamearray[i] = filename.charCodeAt(i);
        }
        filename.split(".")[0].slice(12).match(/.{2}/g).forEach( (hexval,index,array) => {
          this.filenamearray[12+index]+=parseInt(hexval,16);
        });


        for(let i = 0;i<20;i++){
          if(this.headernamearray[i]!==this.filenamearray[i]){
            console.log( " psv file name mismatch! "+filename+" " );
            //debugger;
            break;
          }
        }

        this.B0refs.push( {B0filename:this.headernamearray } );
      break;

      default://unknown
        console.log( {"unknownformat":extraheader});
        debugger;
      break;

    }
    this.blocks = allblocks.slice(firstblock).map( block => new Uint8Array(block) );


    if(this.B0refs.length===1){//psv, mcs?
      let singlefilesave = { filename:this.B0refs[0].B0filename, orderedblockarray:this.blocks };
      this.addfiletolibrary( filename, singlefilesave );
    } else {
      let blockstouched = {};
      this.B0refs.forEach( (b0ref,index) => {
        //not checking if actually not deleted
        if(b0ref.blocknumber===1){//a first block
          blockstouched[index]=true;
          let completesavefile = { filename:b0ref.B0filename, orderedblockarray:[this.blocks[index]] };
          let nextindex = b0ref.nextblockindex;
          for(let i = 1;i<b0ref.howmanyblocks;i++){
            if(nextindex!==null){
              blockstouched[nextindex]=true;
              completesavefile.orderedblockarray.push(this.blocks[nextindex]);
              const theb0ref = this.B0refs[nextindex];
              nextindex = theb0ref.nextblockindex;
              switch(theb0ref.blocknumber){
                case 2:
                  if(nextindex===null){
                    console.log("middle block with no next...");
                    //debugger;
                  }
                break;
                case 3:
                  if(nextindex!==null){
                    console.log("final block but there's a next??");
                    //debugger;
                  }
                break;
                default:
                  console.log("multi part block marked incorrectly.");
                  //debugger;
                break;
              }
            }
          }
          if(nextindex!==null){
            console.log("didn't reach the end! wrong file count?");
            //debugger;
          }
          this.addfiletolibrary( filename+"-"+b0ref.availability, completesavefile );//deleted flag???
        } else {//
          if(blockstouched[index]!==true){
            //console.log("not a first block and not touched");
            const checker = new MCFrame(this.blocks[index].slice(0,PS1MemCard.#FrameSize));
            this.addfiletolibrary( "SCbytes?="+checker.isSC.toString()+" "+filename+" :borked?", { filename:b0ref.B0filename, orderedblockarray:[this.blocks[index]] } );
          }
        }
      });
    }
  }

  static mcfilelibrary = {};

  static compareblocks( block1, block2 ){
    if(block1.byteLength!==block2.byteLength){
      debugger;
      return false;
    }
    for(let i = 0;i<block1.byteLength;i++){
      if(block1[i]!==block2[i]){
        return false;
      }
    }
    return true;
  }

  addfiletolibrary( diskfilename, {filename, orderedblockarray} ){
    const filenamestring = new TextDecoder().decode(filename);
    let found = false;
    let mcfilelibrary = PS1MemCard.mcfilelibrary;//mer

    if(mcfilelibrary[filenamestring]===undefined){
      mcfilelibrary[filenamestring] = [];
    } else {
      mcfilelibrary[filenamestring].forEach( fileob => {
        if(arguments[1].orderedblockarray.length===fileob.file.orderedblockarray.length){
          let theymatch = true;
          for(let i = 0;i<fileob.file.orderedblockarray.length;i++){
            if(!PS1MemCard.compareblocks(fileob.file.orderedblockarray[i], arguments[1].orderedblockarray[i])){
              theymatch = false;
              break;
            }
          }
          if(theymatch){
            found = true;
            fileob.foundin.push(diskfilename);
          }
        }
      });
    }
    if(!found){
      arguments[1].pixelDatas = [];
      const block = arguments[1].orderedblockarray[0];
      const framezero = new MCFrame(block.slice(0,PS1MemCard.#FrameSize));
      for(let i = 1;i<4;i++){
        const start = i*PS1MemCard.#FrameSize;
        const frame = new MCFrame(block.slice(start,start+PS1MemCard.#FrameSize));
        framezero.drawframe(frame);
        arguments[1].pixelDatas.push(frame.pixelData);
      }
      mcfilelibrary[filenamestring].push({file:arguments[1],foundin:[diskfilename]});
    }
  }

  static getreadablelibrary(){
    let readabletsv = "";
    for (const [key, value] of Object.entries(PS1MemCard.mcfilelibrary)) {
      let firstcols = key.substring(0,2)+"\t"+key.substring(2,12)+"\t"+key.substring(12,20)+"\t";
      value.forEach( fileandfound => {
        const fileheader = new MCFrame(fileandfound.file.orderedblockarray[0].slice(0,PS1MemCard.#FrameSize));
        const filetext = fileheader.savestring.replace(/(\r\n|\n|\r)/gm," ").replace("\t"," ").replace("\""," ");//regex nightmares
        readabletsv+=firstcols+
        fileandfound.file.orderedblockarray.length+" block(s)"+"\t"+filetext+"\t"+fileandfound.foundin.length+" times found, in:"+"\t";
        fileandfound.foundin.forEach( diskfilename => {
          readabletsv+=diskfilename+"\t";
        });
        readabletsv+="\r";
      });
    }
    return readabletsv;
  }

  static gethtml(){
    let html = "<div>ID</div><div>Code</div><div>Filename</div><div>Blocks</div><div>Description</div><div>Found in</div>";
    for (const [key, value] of Object.entries(PS1MemCard.mcfilelibrary)) {

      let firstcols = "<div>"+key.substring(0,2)+"</div><div>"+key.substring(2,12)+"</div><div>"+key.substring(12,20)+"</div>";

      value.forEach( (fileandfound, index) => {
        const canvasname = key.split("\0")[0]+index;

        const fileheader = new MCFrame(fileandfound.file.orderedblockarray[0].slice(0,PS1MemCard.#FrameSize));
        const filetext = fileheader.savestring.replace("<","_");
        html+=firstcols+"<div><canvas id=\""+canvasname+"\" width='16' height='16'></canvas>"
        +fileandfound.file.orderedblockarray.length+"</div><div>"+filetext+"</div><details><summary>Found "+fileandfound.foundin.length+" times in provided files.</summary> <ul>";
        fileandfound.foundin.forEach( diskfilename => {
          html+="<li>"+diskfilename+"</li>";
        });
        html+="</ul></details>";
      });
    }
    return html;
  }



  static drawimages( which ){
    for (const [key, value] of Object.entries(PS1MemCard.mcfilelibrary)) {
      value.forEach( (fileandfound, index) => {

        const canvasname = key.split("\0")[0]+index;
        try{
          const canvas = document.getElementById(canvasname);
          const ctx = canvas.getContext("2d");
          const iconImageData = ctx.createImageData(16,16);
          const pixelData = iconImageData.data;
  
          for(let i = 0;i<1024;i++){
            pixelData[i] = fileandfound.file.pixelDatas[which][i];
          }
          ctx.putImageData(iconImageData,0,0);
        } catch {
          console.log(canvasname+" is probably not real data. or messed up filename.");
        }

      });
    }

  }





}







class MCFrame{

  constructor( uint8array ){
    this.data = uint8array;
  }

  get B0availability() {
    return this.data[0];
  }

  get blocknumber(){
    return (this.B0availability&0x0F);
  }

  get blockuse(){
    return (this.B0availability&0xF0);
  }

  get hasdata(){
    return (this.blockuse)===0x50;
  }

  get availability(){
    switch(this.blockuse){
      case 0xA0:
      return "Open";
      case 0x50:
      return "In use";
      case 0xF0:
      return "Unavailable";
      default:
      return "Unknown "+(this.blockuse).toString();
    }
  }

  get blockpart(){
    switch(this.blocknumber){
      case 0x01:
      return "First";
      case 0x02:
      return "Middle Block";
      case 0x03:
      return "End Block";
      default:
      return "Unknown: "+(this.blocknumber).toString();
    }
  }

  get B0reserved(){//000000, or FFFFFF in unavailable block refs
    return this.data.slice(1,4);
  }

  get B0blocksused(){
    return this.data.slice(4,8);
  }

  get howmanyblocks(){
    return ((this.B0blocksused[2]<<8)+this.B0blocksused[1])/0x20;
  }

  get B0nextlinkedblockindex(){//FF,FF in single block files and unavailable block refs
    return this.data.slice(8,0xA);
  }

  get nextblockindex(){
    return this.B0nextlinkedblockindex[1]===0?this.B0nextlinkedblockindex[0]:null;
  }

  get B0filename(){
    return this.data.slice(0xA,0x1E);
  }

  get filenamestring(){
    return new TextDecoder().decode(this.B0filename);
  }

  get B0unusedarea(){
    return this.data.slice(0x1E, this.data.byteLength-1);
  }

  get isgood(){
    let xor = 0;
    for(let i = 0;i<this.data.byteLength-1;i++){
      xor^=this.data[i];
    }
    if(this.data[this.data.byteLength-1]!=xor){
      return false;
    }
    return true;
  }

  IsMCFrame(){
    if(this.data[0] != 'M'.charCodeAt(0)){//String.fromCharCode(64);
      return false;
    }
    if(this.data[1] != 'C'.charCodeAt(0)){
      return false;
    }
    for(let i = 2;i<this.data.byteLength-1;i++){
      if(this.data[i] != 0){
        return false;
      }
    }
    return this.isgood;
  }

  FilledWith(){
    const foundval = this.data[0];
    for(let i = 1;i<this.data.byteLength;i++){
      if(this.data[i] != foundval){
        return null;
      }
    }
    return foundval;
  }



  IsUnavailableFrame(){
    for(let i = 0;i<this.data.byteLength-1;i++){
      switch(i){
        case 0:
        case 1:
        case 2:
        case 3:
        case 8:
        case 9:
          if(this.data[i] != 0xFF){
            //console.log("not FF at "+i+" (was "+this.data[i]);
            return false;
          }
        break;

        default:
          if(this.data[i] != 0){
            //console.log("not 00 at "+i+" (was "+this.data[i]);
            return false;
          }
        break;
      }
    }
    return true;
  }


  getall(){
    return {
      availability:this.availability,
      blockpart:this.blockpart,
      reserved:this.B0reserved,
      howmanyblocks:this.howmanyblocks,
      nextblockindex:this.nextblockindex,
      filenamestring:this.filenamestring,
      unusedarea:this.B0unusedarea,
      isgood:this.isgood,
      IsMCFrame:this.IsMCFrame(),
      FilledWith:this.FilledWith(),
      IsUnavailableFrame:this.IsUnavailableFrame()
    }
  }

  addtostringtsv( toaddto, diskfilename, index,  ){
    if(toaddto===""){
      toaddto = 
      "filename"+"\t"+"index"+"\t"+
      "filenamestring"+"\t"+"isgood"+"\t"+
      "availability"+"\t"+"blockpart"+"\t"+
      "howmanyblocks"+"\t"+"nextblockindex"+"\t"+
      "reserved"+"\r";
    }
    toaddto+= diskfilename+"\t"+index+"\t"+
    this.filenamestring+"\t"+this.isgood+"\t"+
    this.availability+"\t"+this.blockpart+"\t"+
    this.howmanyblocks+"\t"+this.nextblockindex+"\t"+
    this.B0reserved+"\r";
    return toaddto;
  }


  //B1 stuff.
  get B1SC(){
    return this.data.slice(0,2);
  }

  get isSC(){
    return  this.B1SC[0]==='S'.charCodeAt(0) &&
            this.B1SC[1]==='C'.charCodeAt(0);
  }

  get B1IconFlag(){
    return this.data[2];
  }

  get B1BlockNo(){
    return this.data[3];
  }

  get B1SaveStringArray(){
    return this.data.slice(4,0x44);
  }

  get savestring(){
    //null terminated - how to split at first zero found? todo.
    return new TextDecoder("shift-jis").decode(this.B1SaveStringArray);
  }

  get B1SaveStringPad(){
    return this.data.slice(0x44,0x50);
  }

  get B1PocketStationMCIconFrames(){
    return this.data.slice(0x50,0x52);
  }

  get B1PocketStationIdent(){
    return this.data.slice(0x52,0x56);
  }

  get B1PocketStationAPIconFrames(){
    return this.data.slice(0x56,0x58);
  }

  get B1PocketStationPadding(){
    return this.data.slice(0x58,0x60);
  }

  get B1IconCLUT(){
    return this.data.slice(0x60,0x80);//use it. todo.
  }



  drawframe( drawframe ){
    if(!this.isSC){
      console.log("tried to draw using a non SC frame");
      return;
    }
    if(this.colour===undefined){
      this.colour = [];
      for(let i = 0;i<16;i++){
        const byte1 = this.B1IconCLUT[i*2+0];
        const byte2 = this.B1IconCLUT[i*2+1];
        const r =  (byte1&0x1F)<<3;//shift to 255max
        const g = ((byte1&0xE0)>>2)|
                  ((byte2&0x03)<<6);
        const b =  (byte2&0x7C)<<1;
        this.colour.push({r,g,b});
      }
    }

    if(drawframe.pixelData===undefined){
      drawframe.pixelData = new Uint8ClampedArray(1024);
      const chans = 4;
      for(let y = 0;y<16;y++){
        for(let x = 0;x<8;x++){//8 bytes across
          const palrefs = drawframe.data[y*8+x];
          const ref1 = this.colour[(palrefs&0x0F)];
          const ref2 = this.colour[(palrefs&0xF0)>>4];
          
          drawframe.pixelData[(((y*16)+(x*2)+0)*chans)+0] = ref1.r;
          drawframe.pixelData[(((y*16)+(x*2)+0)*chans)+1] = ref1.g;
          drawframe.pixelData[(((y*16)+(x*2)+0)*chans)+2] = ref1.b;
          drawframe.pixelData[(((y*16)+(x*2)+0)*chans)+3] = 255;
          
          drawframe.pixelData[(((y*16)+(x*2)+1)*chans)+0] = ref2.r;
          drawframe.pixelData[(((y*16)+(x*2)+1)*chans)+1] = ref2.g;
          drawframe.pixelData[(((y*16)+(x*2)+1)*chans)+2] = ref2.b;
          drawframe.pixelData[(((y*16)+(x*2)+1)*chans)+3] = 255;
        }
      }
    }
  }

            




}





  




  



export default PS1MemCard


