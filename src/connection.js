const fs = require("fs");
const sftpClient = require("ssh2-sftp-client");
const archiver = require("archiver");
const {AutoComplete} = require("autocomplete");

let sftp = new sftpClient();
let cDirectory = "/home/wl";
let lastCMD = "";
let sftpData = {
  "host": "128.76.244.245",
  "port": "22",
  "username": "pi",
  "password": "entotre4",
};

let ac = new AutoComplete(document.querySelector("div#input input"), [
  // Command List autocompletion possible combos

  // help
  "help",

  // connect
  "connect",

  // ls
  "ls",

  // clear
  "clear",

  // cd
  "cd",
  "cd ..",

  // get
  "get",
  "get \"remote-path\" \"local-path\"",

  // put
  "put",
  "put \"local-path\" \"remote-path\"",

  // putzip
  "putzip",
  "putzip -root",
  "putzip -keep",
  "putzip -root -keep",
  "putzip -keep -root",
  "putzip \"local-path\"",
  "putzip \"local-path\" \"remote-path\"",
  "putzip -root \"local-path\"",
  "putzip -keep \"local-path\"",
  "putzip -root -keep \"local-path\"",
  "putzip -keep -root \"local-path\"",
  "putzip -root \"local-path\" \"remote-path\"",
  "putzip -keep \"local-path\" \"remote-path\"",
  "putzip -root -keep \"local-path\" \"remote-path\"",
  "putzip -keep -root \"local-path\" \"remote-path\"",

  // rm
  "rm",
  "rm -f",
  "rm -d",
  "rm -l",
  "rm -f \"remote-path\"",
  "rm -d \"remote-path\"",
  "rm -l \"remote-path\"",
  "rm \"remote-path\"",

  // font
  "font",
  "font reset",
  "font size",
  "font size 20",

  // exit
  "exit",
]);

ac.onlyFullText = true;

class Command {
  /**
   * Construct a new command.
   * @param {string} command 
   * @param {(this: Command, command: string, args: string[], rest: string)} fn
   * @param {boolean} async
   * @param {boolean} doNotAdd 
   */
  constructor(command, fn, help = "No help available for this command.", async = false, doNotAdd = false)
  {
    this.command = command;
    this.fn = fn;
    this.help = help;
    this.async = async;

    if (!doNotAdd) {
      cmdList.push(this);
    }
  }

  /**
   * Display the help text for this command.
   */
  getHelp()
  {
    return cmdlog(this.help+"<br>");
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
  },
    "Start up a connection to the server."
  );
  
  // File list command
  new Command("ls", async function() {
    try {
      var files = await sftp.list(cDirectory);
      cmdlog(separator(true), false);
      // Insert go back
      cmdlog("..", false, async function() {
        await runCMD("cd ..");
        await runCMD("ls");
      }, {"class": "dirEnt", "title": "Parent Directory"});

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.includes(" ")) {
          file.name = "\""+file.name+"\"";
        }
        var options = {};
        var fn = async function() {
          await runCMD("cd "+file.name);
          await runCMD("ls");
        }
        if (file.type == "d") {
          // color = "#4287f5";
          options.class = "dirEnt";
        }
        if (file.type == "-") {
          // color = "lightgrey";
          options.class = "fileEnt";
          fn = function() {
            var name = file.name;
            if (name.startsWith("\"") && name.endsWith("\"")) {
              name = name.substring(1, name.length-1);
            }
            if (!fs.existsSync("./_downloads/")) {
              fs.mkdirSync("./_downloads/");
            }
            runCMD(`get "${name}" "./_downloads/${name}"`, false);
          };
        }
        if (file.type == "l") {
          // color = "lightblue";
          options.class = "linkEnt";
        }

        if (file.type == "-") {
          var bData = bytesTo(file.size);
          cmdlog(file.name + " - " + bData.size+" "+bData.type, false, fn, options);
        }
        else if (file.type == "d" || file.type == "l") {
          cmdlog(file.name, false, fn, options);
        }
      }
      if (files.length == 0) {
        logError("This folder is empty");
      }
      // Insert go back at end as well
      cmdlog("..", false, async function() {
        await runCMD("cd ..");
        await runCMD("ls");
      }, {"class": "dirEnt", "title": "Parent Directory"});

      cmdlog(separator(true), false);
      return files;
    } catch (error) {
      logError(error);
      logError("Remember to do ``connect`` first.");
    }
  },
    "Displays a list of files and folders within the current directory.<br>"+
    "Folders are blue, (symbolic links are a light blue)<br>"+
    "Clicking folders will execute the ``cd`` command on that directory.<br<br>"+
    "File are grey and display the size after the name.<br>"+
    "Clicking files will download it into a folder ``/_downloads/`` in the apps directory."
  );

  new Command("clear", function (){
    clearLog();
    cmdlog(">>> Screen cleared.");
  }, "Clears the screen from previous command execution text.");

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
  },
    "cd [directory]<br>"+
    "Sets and displays the current directory."
  );

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
  },
    "get (remote-path) [local-path]<br>"+
    "Downloads a remote file to the local system",
    true
  );

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
  },
    "put (local-path) [remote-path]<br>"+
    "Uploads a local file to the remote system",
    true
  );

  new Command("putzip", async function(cmd, args) {
    try {
      var options = {
        root: false,
        keep: false
      }
      // Check parameters

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith("-")) {
          if (arg == "-root") {
            options.root = true;
          }
          if (arg == "-keep") {
            options.keep = true;
          }
          unsetArray(args, i);
          i--;
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
        if (!options.keep) {
          fs.unlinkSync(localPath+'.zip');
        }
      });
    } catch (error) {
      logError(error);
    }
  },
    "putzip (local-path) [remote-path] [-keep, -root]<br>"+
    "Zips and uploads a local file or directory to the remote system. The remote system will receive a .zip file<br>"+
    "If you use the ``-keep`` argument when zipping any entry, the zipped file won't be deleted from your system after it has been uploaded, and will stay on your system as well."+
    "If you use the ``-root`` argument when zipping a folder, the files in the folder will be put in the root of the zip file. Otherwise it will be stored in a subfolder.<br>",
    true
  );

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
  },
    "rm (remote-path) [-d | -f | -l]<br>"+
    "Removes a file or directory from the remote system.<br>"+
    "If you use the ``-d`` argument, it will only attempt to remove directories.<br>"+
    "If you use the ``-f`` argument, it will only attempt to remove files.<br>"+
    "If you use the ``-l`` argument, it will only attempt to remove symbolic links."
  );

  new Command("font", function(cmd, args) {
    if (args[1] == "reset") {
      document.getElementById("log").style.fontSize = "";
    }
    else if (args[1] == "size" && !isNaN(args[2])) {
      if (!(document.getElementById("log").style.fontSize = args[2]+"px")) {
        logError("Couldn't set font size: Unknown Error");
      }
    }
    else {
      this.getHelp();
    }
  },
    "font (size | reset) [IF size: Size - ``Integer`` ]<br>"+
    "Changes the size of the log font."
  );

  new Command("help", function(cmd, args) {
    if (args[1]) {
      for (let i = 0; i < cmdList.length; i++) {
        const cmdItem = cmdList[i];
        if (cmdItem.command.toLowerCase() == args[1].toLowerCase()) {
          return cmdItem.getHelp();
        }
      }
    }
    else {
      const info = {};
      for (let i = 0; i < cmdList.length; i++) {
        const cmdItem = cmdList[i];
        cmdlog(cmdItem.command+":");
        info[cmdItem.command] = cmdItem.getHelp();
      }
      return info;
    }
  }, 
    "help [command]<br>"+
    "Displays a single or every commands help text."
  );

  new Command("exit", function() {
    sftp.end();
    cmdlog("Shutting down connection...");
    sftp.on("end", function(){
      cmdlog("Exited");
      toggleCMD();
    });
  }, "Terminates the connection.");
}

/**
 * 
 * @param {string} command 
 */
async function runCMD(command, clickReset = true)
{
  // Reset clickables
  if (clickReset) {
    var _clickables = document.querySelectorAll("[clickable]");
    for (let i = 0; i < _clickables.length; i++) {
      const elm = _clickables[i];
      elm.toggleAttribute("clickable", false);
      elm.removeAttribute("onclick");
      delete funcs[elm.id];
    }
  }

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
      /**
       * @type {Promise<any>}
       */
      var returnValue;
      if(cmd.async) {returnValue = cmd.fn(command, args, rest);}
      else {returnValue = await cmd.fn(command, args, rest);}
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
 * @param {{"class":string, "title":string}} options
 */
function cmdlog(text, color = "", onclickFN = false, options = {}){
  const log = document.querySelector("#log");
  var textToLog = markdown(text.toString())+"<br>";
  var id = generateRandomString("log_");
  if (color != "" && color != false) {
    textToLog = "<div id=\""+id+"\" style=\"color:"+color+";\">"+textToLog+"</div>";
  }
  else {
    textToLog = "<div id=\""+id+"\">"+textToLog+"</div>";
  }
  
  log.innerHTML += textToLog;
  scrollToBottom();
  
  var obj = document.getElementById(id);

  // options
  for (const key in options) {
    if (options.hasOwnProperty(key)) {
      const value = options[key];
      obj.setAttribute(key, value);
    }
  }

  if (onclickFN) {
    funcs[id] = onclickFN;
    obj.toggleAttribute("clickable");
    if (typeof onclickFN == "function") {
      obj.setAttribute("onclick", "funcs[this.id]()");
    }
    else if (typeof onclickFN == "string") {
      obj.setAttribute("onclick", onclickFN);
    }
  }
  return textToLog;
}

/**
 * Generate a random string with optional prefix.
 * @param {string} prefix Something to be fixed in front of the random string.
 */
function generateRandomString(prefix = "")
{
  var symbols = "abcdefghijklmnopqrstuvxwzABCDEFGHIJKLMNOPQRSTUVXWZ1234567890";
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
  else if (path.startsWith("~")) {
    dirToTest = "/home/"+sftpData.username+"/"+path.substring(1);
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
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() == "c") {
    runCMD("clear");
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

/**
 * 
 * @param {number} bytes 
 * @param {"auto"|"kb"|"mb"|"gb"} type 
 */
function bytesTo(bytes, type = "auto")
{
  if (type == "auto") {
    if (bytes >= 1073741824) {
      type = "gb";
      bytes = bytes / 1073741824;
    }
    else if (bytes >= 1048576) {
      type = "mb";
      bytes = bytes / 1048576;
    }
    else if (bytes >= 1024) {
      type = "kb";
      bytes = bytes / 1024;
    }
    else {
      type = "bytes";
    }
    return {
      "size": Math.ceil(bytes),
      "type": type
    }
  }
}

const funcs = {
}

// Run at start
setTimeout(async () => {
  await runCMD("connect");
  cmdlog(`Connected to `);
  await runCMD("cd ../wl");
}, 100);

