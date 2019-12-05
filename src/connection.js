const fs = require("fs");
const sftpClient = require("ssh2-sftp-client");
const archiver = require("archiver");

let sftp = new sftpClient();
let cDirectory = "/home/wl";
let lastCMD = "";
let sftpData = {
  "host": "128.76.244.245",
  "port": "22",
  "username": "pi",
  "password": "entotre4",
};

class Command {
  /**
   * 
   * @param {string} command 
   * @param {(command: string, args: string[], rest: string)} fn 
   * @param {boolean} doNotAdd 
   */
  constructor(command, fn, help = "", doNotAdd = false)
  {
    this.command = command;
    this.fn = fn;

    if (!doNotAdd) {
      cmdList.push(this);
    }
  }
}

/**
 * @type {Command[]}
 */
var cmdList = [];

addDefaultCommands();
/**
 * Adds the default commands... duh.  
 * This is run immediately at start up.
 */
function addDefaultCommands()
{
  // Connect command
  new Command("connect", async function() {
    let connection;
    try {
      connection = await sftp.connect(sftpData).then(async function() {
        cDirectory = await sftp.cwd();
      });
    } catch (error) {
      logError(error);
      logError("Trying to reconnect...");
      await sftp.end();
      sftp.on("end", async function(){
        cmdlog("Disconnected from Server");
        runCMD("connect");
      });
      return error;
    }
    cmdlog("Successfully connected to server.");
    return connection;
  });
  
  // File list command
  new Command("ls", async function() {
    try {
      var files = await sftp.list(cDirectory);
      cmdlog(separator(true), false);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.includes(" ")) {
          file.name = "\""+file.name+"\"";
        }
        var color = "white";
        if (file.type == "d") {
          color = "#4287f5";
        }
        if (file.type == "-") {
          color = "lightgrey";
        }
        if (file.type == "l") {
          color = "lightblue";
        }
        cmdlog(file.name, color, function() {
          console.log(file.name);
        });
      }
      if (files.length == 0) {
        logError("This folder is empty");
      }
      cmdlog(separator(true), false);
      return files;
    } catch (error) {
      logError(error);
      logError("Remember to do ``connect`` first.");
    }
  });

  new Command("clear", function (){
    clearLog();
  });

  new Command("cd", async function(cmd, args) {
    try {
      if (args.length > 1 && args[1] != "") {
        var data = await getPath(args[1]);
        var path = data.path;
        var type = data.type;
        if (type == "d") {
          cDirectory = path;
          return cmdlog(cDirectory);
        }
        // If no file was found, search different casing
        var files = await sftp.list(cDirectory);
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if ((file.type == "d" || file.type == "l") && (cDirectory+"/"+file.name).toLowerCase() == data.path.toLowerCase()) {
            args[1] = cDirectory+"/"+file.name;
          }
        }

        data = await getPath(args[1]);
        path = data.path;
        type = data.type;
        if (type == "d") {
          cDirectory = path;
          return cmdlog(cDirectory);
        }
        else if (type == "-"){
          logError("\""+path+"\" is a file, not a folder.");
        }
        else {
          logError("Path does not exist \""+path+"\"")
        }
      }
      else {
        cmdlog(cDirectory);
      }
    } catch (error) {
      logError(error);
      return error;
    }
  });

  // get "/var/www/html/files/getFiles.php" ./file.php
  new Command("get", async function(cmd, args) {
    try {
      var fromData = await getPath(args[1]);
      var from = fromData.path;
      var to;
      if(args[2])
      {
        to = args[2];
      }
      else {
        to = "./"+from.split("/").pop();
      }
      cmdlog("Downloading file...");
      await sftp.fastGet(from, to);
      cmdlog(`"${from}" was successfully downloaded to "${to}"`, "#00ff15");
    } catch (error) {
      logError(error);
    }
  });

  new Command("put", async function(cmd, args) {
    try {
      fs.accessSync(args[1]);
      var from = args[1].replace(/\\+/g, "/");
      var to;
      if(args[2])
      {
        to = await getPath(args[2]);
      }
      else {
        to = await getPath("./"+from.split("/").pop());
      }
      to = to.path;
      cmdlog("Uploading file...");
      await sftp.fastPut(from, to);
      console.log(from);
      console.log(to);  
      cmdlog(`"${from}" was successfully uploaded to "${to}"`, "#00ff15");
    } catch (error) {
      logError(error);
    }
  });

  new Command("putzip", async function(cmd, args) {
    try {
      var options = {
        root: false,
      }
      // Check parameters
      var t_args = args;
      for (let i = 0; i < t_args.length; i++) {
        const arg = t_args[i];
        if (arg.startsWith("-")) {
          if (arg == "-root") {
            options.root = true;
          }
          unsetArray(args, i);
        }
      }
      
      var arch = archiver("zip");
      var localPath = args[1];
      var output = fs.createWriteStream(localPath+".zip");
      arch.pipe(output);
      var stat = fs.statSync(localPath);
      if (stat.isDirectory()) {
        if (!options.root) {
          cmdlog("Adding folder to zip...");
          arch.directory(localPath, getItemFromPath(localPath));
        }
        else {
          cmdlog("Adding files from folder to zip...");
          arch.directory(localPath, false);
        }
      }
      else if (stat.isFile()){
        cmdlog("Zipping file...");
        arch.file(localPath);
      }
      else {
        logError("unidentified");
      }
      arch.finalize();
      output.on("close", async function() {
        if (args[2]) {
          await runCMD('put "'+localPath+'.zip" "'+args[2]+'"');
        }
        else {
          await runCMD('put "'+localPath+'.zip"');
        }
        fs.unlinkSync(localPath+'.zip');
      });
    } catch (error) {
      logError(error);
    }
  });

  new Command("rm", async function(cmd, args) {
    try {
      var options = {
        type: false,
      }
      // Check parameters
      var t_args = args;
      for (let i = 0; i < t_args.length; i++) {
        const arg = t_args[i];
        if (arg.startsWith("-")) {
          if (arg == "-d") {
            options.type = "d";
          }
          else if (arg == "-f") {
            options.type = "-";
          }
          else if (arg == "-l") {
            options.type = "l";
          }
          unsetArray(args, i);
        }
      }

      var file = await getPath(args[1]);
      if (!file.type) {
        logError(`"${file.path}" does not exist.`);
        return;
      }
      else {
        if (options.type != false) {
          if (options.type == file.type) {
            var msg = await sftp.delete(file.path);
            cmdlog(msg, "#00ff15");
          }
          else {
            logError(`"${file.path}" was of the wrong type "${file.type}", only accepting "${options.type}" with current parameters.`);
          }
          return;
        }
          var msg = await sftp.delete(file.path);
          cmdlog(msg, "#00ff15");
          return;
      }
    } catch (error) {
      logError(error);
    }
  });
}

/**
 * 
 * @param {string} command 
 */
async function runCMD(command)
{
  lastCMD = command;
  const rgx = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const log = document.querySelector("#log");
  const cmdInput = document.querySelector("#input input");
  var fullCommand = command;
  var args = command.match(rgx);
  var rest = command.substring(args[0].length+1);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg.startsWith("\"") && arg.endsWith("\"")) || arg.startsWith("'") && arg.endsWith("'")) {
      args[i] = arg.substring(1, arg.length-1);
    }
  }

  var command = args[0];

  cmdInput.setAttribute("disabled", true);
  cmdInput.value = "";

  cmdlog("<span style=\"color: green;\">&gt; </span> "+fullCommand);

  for (let i = 0; i < cmdList.length; i++) {
    const cmd = cmdList[i];
    if (cmd.command == command) {
      cmdInput.setAttribute("placeholder", "Executing...");
      var returnValue = await cmd.fn(command, args, rest);
      cmdInput.removeAttribute("disabled");
      cmdInput.removeAttribute("placeholder");
      cmdInput.focus();
      return returnValue;
    }
  }
  // If no command available:
  logError("Invalid command \""+command+"\"");

  scrollToBottom();
  cmdInput.removeAttribute("disabled");
  cmdInput.removeAttribute("placeholder");
  cmdInput.focus();
}

/**
 * 
 * @param {boolean} returnText
 */
function separator(returnText = false){
  var styling = "width: 100%; height: 20px; display: block; border-color: #333333; border-bottom-style: solid; box-sizing: border-box;";
  if (!returnText) {
    const div = document.createElement("div");
    div.style = styling;
    return div;
  }
  else {
    return "<div style=\""+styling+"\"></div>";
  }
}

/**
 * Log to CMD log
 * @param {string} text
 * @param {boolean} breakLine
 * @param {Function|string|false} onclickFN
 */
function cmdlog(text, color = "white", onclickFN = false){
  const log = document.querySelector("#log");
  var textToLog = markdown(text.toString())+"<br>";
  var id = generateRandomString("log_");
  if (color != "") {
    textToLog = "<div id=\""+id+"\" style=\"color:"+color+";\">"+textToLog+"</div>";
  }
  
  log.innerHTML += textToLog;
  scrollToBottom();

  if (onclickFN) {
    funcs[id] = onclickFN;
    var obj = document.getElementById(id);
    obj.toggleAttribute("clickable");
    if (typeof onclickFN == "function") {
      obj.setAttribute("onclick", "funcs[this.id]()");
      console.log("Set as Function");
      // console.log(obj);
    }
    if (typeof onclickFN == "string") {
      obj.setAttribute("onclick", onclickFN);
      console.log("Set as string");
    }
  }
  setTimeout(() => {
  }, 0);
  return textToLog;
}

/**
 * Generate a random string with optional prefix.
 * @param {string} prefix Something to be fixed in front of the random string.
 */
function generateRandomString(prefix = "")
{
  var symbols = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","x","w","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","X","W","Z","1","2","3","4","5","6","7","8","9","0"];
  var string = prefix;
  for (let i = 0; i < 10; i++) {
    string += symbols[randomInt(symbols.length-1)];
  }
  return string;
}

function randomInt(max = 100, min = 0)
{
  return Math.round(Math.random() * (+max - +min) + +min);
}

function scrollToBottom()
{
  const log = document.querySelector("#log");
  log.scrollTop = log.scrollHeight;
}

function clearLog()
{
  const log = document.querySelector("#log");
  log.innerHTML = "";
}

/**
 * 
 * @param {string} text 
 */
function markdown(text)
{
  text = text.replace(/(``)(.+?)(``)/g, "<span style=\"background: black; padding-left: 4px; padding-right: 4px; border-radius: 20px; border-style: solid; border-color: white; border-width: 1px;\">$2</span>");
  return text;
}

/**
 * For when shit doesn't work :)
 * @param {string} text Text to show
 */
function logError(text) {
  cmdlog(text, color = "red");
}

/**
 * 
 * @param {string} path Path to get
 */
async function getPath(path)
{
  var fullPath;
  var dirToTest;
  if (path.startsWith("/")) {
    dirToTest = path;
  }
  else {
    dirToTest = cDirectory+"/"+path;
  }

  fullPath = await sftp.realPath(dirToTest);
  var type = await sftp.exists(fullPath);
  return {
    "path": fullPath,
    "type": type
  }
}

// Key presses
window.addEventListener("keydown", function(e) {
  if (e.ctrlKey && e.key.toLowerCase() == "t") {
    toggleCMD();
  }
  if (e.key == "ArrowUp") {
    const cmdInput = document.querySelector("#input input");
    if (document.activeElement == cmdInput) {
      cmdInput.value = lastCMD;
      setTimeout(() => {
        cmdInput.setSelectionRange(lastCMD.length, lastCMD.length);
      }, 0);
    }
  }
});

function toggleCMD()
{
  const cmd = document.querySelector("#cmd");
  const cmdInput = document.querySelector("#input input");
  cmd.toggleAttribute("disabled");

  if (cmd.hasAttribute("disabled") && !cmdInput.hasAttribute("disabled")) {
    cmdInput.toggleAttribute("disabled");
  }
  else if (!cmd.hasAttribute("disabled") && cmdInput.getAttribute("placeholder") != "Executing...") {
    cmdInput.removeAttribute("disabled");
    cmdInput.focus();
  }
}

/**
 * @param {string} path 
 */
function getItemFromPath(path){
  return path.replace(/\\+/g, "/").split("/").pop();
}

/**
 * Unset a value from an array.
 * @param {any[]} array 
 * @param {number} index 
 */
function unsetArray(array, index) {
  return array.splice(index, 1);
}



// Run at start
setTimeout(async () => {
  await runCMD("connect");
  cmdlog(`Connected to `);
  await runCMD("cd ../wl");
}, 100);

const funcs = {
}