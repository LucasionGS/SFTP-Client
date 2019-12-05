const fs = require("fs");
const sftpClient = require("ssh2-sftp-client");

let sftp = new sftpClient();
let cDirectory = "/home/wl";

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
      connection = await sftp.connect({
        "host": "128.76.244.245",
        "port": "22",
        "username": "pi",
        "password": "entotre4",
      }).then(async function() {
        cDirectory = await sftp.cwd();
      });
    } catch (error) {
      cmdlog(error.toString());
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
        cmdlog(file.name, color);
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
      var finishMsg = await sftp.fastGet(from, to);
      cmdlog(finishMsg, "#00ff15");
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
      var finishMsg = await sftp.fastPut(from, to);
      console.log(from);
      console.log(to);  
      cmdlog(finishMsg, "#00ff15");
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
  var rgx = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
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

  cmdlog(fullCommand);

  for (let i = 0; i < cmdList.length; i++) {
    const cmd = cmdList[i];
    if (cmd.command == command) {
      cmdInput.setAttribute("placeholder", "Executing...");
      await cmd.fn(command, args, rest);
      cmdInput.removeAttribute("disabled");
      cmdInput.removeAttribute("placeholder");
      cmdInput.focus();
      return;
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
 */
function cmdlog(text, color = "white"){
  const log = document.querySelector("#log");
  var textToLog = markdown(text.toString())+"<br>";
  if (color != "") {
    textToLog = "<span style=\"color:"+color+";\">"+textToLog+"</span>";
  }
  
  log.innerHTML += textToLog;
  scrollToBottom();
  return textToLog;
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

// Run at start
setTimeout(() => {
  runCMD("connect");
}, 100);

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