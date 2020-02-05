const fs = require("fs");
const sftpClient = require("ssh2-sftp-client");
const archiver = require("archiver");
const {AutoComplete} = require("ion-ezautocomplete");
const {ContextMenu} = require("ionlib");

let sftp = new sftpClient();
let cDirectory = "";
let lastCMD = "";
/**
 * SFTP Credentials.
 * @type {{"host": string,"port": string,"username": string,"password": string}}
 */
let sftpData = {
  "host": "",
  "port": 22,
  "username": "",
  "password": ""
};

let default_sftpData = {
  "host": "",
  "port": 22,
  "username": "",
  "password": ""
};

/**
 * @type {default_sftpData}
 */
let tmp_newSftp = {
  "host": "",
  "port": 22,
  "username": "",
  "password": ""
};

/**
 * @type {HTMLInputElement}
 */
let g_cmdInput = document.querySelector("div#input input");
let ac = new AutoComplete(document.querySelector("div#input input"), [
  // Command List autocompletion possible combos

  // help
  "help",

  // connect
  "connect",

  // ls
  "ls",
  "list",

  // clear
  "clear",

  // cd
  "cd",
  "cd ~",
  "cd ..",

  // get
  "get",
  "get \"remote-path\" \"local-path\"",
  "download",
  "download \"remote-path\" \"local-path\"",

  // put
  "put",
  "put \"local-path\" \"remote-path\"",
  "upload",
  "upload \"local-path\" \"remote-path\"",

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
  "uploadzip",
  "uploadzip -root",
  "uploadzip -keep",
  "uploadzip -root -keep",
  "uploadzip -keep -root",
  "uploadzip \"local-path\"",
  "uploadzip \"local-path\" \"remote-path\"",
  "uploadzip -root \"local-path\"",
  "uploadzip -keep \"local-path\"",
  "uploadzip -root -keep \"local-path\"",
  "uploadzip -keep -root \"local-path\"",
  "uploadzip -root \"local-path\" \"remote-path\"",
  "uploadzip -keep \"local-path\" \"remote-path\"",
  "uploadzip -root -keep \"local-path\" \"remote-path\"",
  "uploadzip -keep -root \"local-path\" \"remote-path\"",
  
  // rm
  "rm",
  "rm -f",
  "rm -d",
  "rm -l",
  "rm -f \"remote-path\"",
  "rm -d \"remote-path\"",
  "rm -l \"remote-path\"",
  "rm \"remote-path\"",
  "delete",
  "delete -f",
  "delete -d",
  "delete -l",
  "delete -f \"remote-path\"",
  "delete -d \"remote-path\"",
  "delete -l \"remote-path\"",
  "delete \"remote-path\"",
  "remove",
  "remove -f",
  "remove -d",
  "remove -l",
  "remove -f \"remote-path\"",
  "remove -d \"remote-path\"",
  "remove -l \"remote-path\"",
  "remove \"remote-path\"",
  
  // font
  "font",
  "font reset",
  "font size",
  "font size 20",

  // exit
  "exit",

  // autocompletes
  "autocompletes",

  // restart
  "restart",
  "reload",
]);
ac.onlyFullText = true;

let fileCM = new ContextMenu([
  {
    "name": "File action"
  },
  {
    "name": "Download file",
    "click": (ev, ref, btn) => {
      funcs[ref.id]();
    }
  },
  {
    "name": "Download file as...",
    "click": (ev, ref, btn) => {
      var _newfilename = ref.getAttribute("filename");
      var _oldfilename = ref.getAttribute("filename");
      if (_oldfilename.includes(" ")) {
        _oldfilename = "\""+_oldfilename+"\"";
      }
      
      if (_newfilename.startsWith("\"") && _newfilename.endsWith("\"")) {
        _newfilename = _newfilename.substring(1, _newfilename.length-1);
      }
      g_cmdInput.value = "get "+_oldfilename+" \"_downloads/"+_newfilename+"\"";
      g_cmdInput.focus();
      g_cmdInput.setSelectionRange(("get "+_oldfilename+" \"_downloads/").length, ("get "+_oldfilename+" \"_downloads/"+_newfilename+"").length);
    }
  },
  {
    "name": "Remove file",
    "click": (ev, ref, btn) => {
      var _filename = ref.getAttribute("filename");
      
      if (_filename.startsWith("\"") && _filename.endsWith("\"")) {
        _filename = _filename.substring(1, _filename.length-1);
      }
      if (_filename.includes(" ")) {
        _filename = "\""+_filename+"\"";
      }

      cmdlog("Are you sure you want to delete "+_filename+"? This cannot be undone.");
      cmdlog("I'm sure", "green", () => {
        runCMD("rm -f "+_filename);
        resetClickables();
      });
      cmdlog("No, nevermind actually", "red", () => {
        cmdlog("Keeping file.");
        resetClickables();
      });
    }
  },
]);

let directoryCM = new ContextMenu([
  {
    "name": "Directory action"
  },
  {
    "name": "Remove directory",
    "click": (ev, ref, btn) => {
      var _filename = ref.getAttribute("filename");
      
      if (_filename.startsWith("\"") && _filename.endsWith("\"")) {
        _filename = _filename.substring(1, _filename.length-1);
      }
      if (_filename.includes(" ")) {
        _filename = "\""+_filename+"\"";
      }

      cmdlog("Are you sure you want to delete "+_filename+"? This cannot be undone.");
      cmdlog("I'm sure", "green", () => {
        runCMD("rm "+_filename);
        resetClickables();
      });
      cmdlog("No, nevermind actually", "red", () => {
        cmdlog("Keeping directory.");
        resetClickables();
      });
    }
  },
  {
    "name": "Remove directory (Recursively)",
    "click": (ev, ref, btn) => {
      var _filename = ref.getAttribute("filename");
      
      if (_filename.startsWith("\"") && _filename.endsWith("\"")) {
        _filename = _filename.substring(1, _filename.length-1);
      }
      if (_filename.includes(" ")) {
        _filename = "\""+_filename+"\"";
      }

      cmdlog("Are you sure you want to delete "+_filename+"? This cannot be undone.");
      cmdlog("I'm sure", "green", () => {
        runCMD("rm -R "+_filename);
        resetClickables();
      });
      cmdlog("No, nevermind actually", "red", () => {
        cmdlog("Keeping directory.");
        resetClickables();
      });
    }
  },
]);

class Command {
  /**
   * Construct a new command.
   * @param {string|string[]} command The executable name/names for this command.
   * @param {(this: Command, command: string, args: string[], rest: string)} fn The function that will run when this command is executed.
   * @param {boolean} help The help text that will display when the user executes the `help` command with this command.
   * @param {boolean} _async If the software should allow new incoming commands while this command is running. (Default `false`)
   * @param {boolean} doNotAdd Set to true if you don't want this command added automatically to the list of commands. (Default `false`)
   */
  constructor(command, fn, help = "No help available for this command.", _async = false, doNotAdd = false)
  {
    this.command = command;
    /**
     * Tells whether or not this command has multiple executable names.
     * @type {boolean} 
     */
    this.multi = false;
    if (typeof command == "object") {
      this.multi = true;
    }
    else {
    }
    /**
     * The function that will run when this command is executed.
     */
    this.fn = fn;
    /**
     * The help text that will display when the user executes the `help` command with this command.
     */
    this.help = help;
    /**
     * If the software should allow new incoming commands while this command is running. (Default `false`)
     */
    this.async = _async;

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
  // New Connection config
  new Command("createconnection", function() {
    if (fs.existsSync("./connections/")) {
      fs.mkdirSync("./connections/", {
        recursive: true
      });
    }
    tmp_newSftp.host = "";
    tmp_newSftp.port = 22;
    tmp_newSftp.username = "";
    tmp_newSftp.password = "";
    ac.enabled = false;
    cmdlog("Enter a host:");
    new InputListener((command, args, rest) => {
      var full = args.join(" ");
      tmp_newSftp.host = full;
      cmdlog(full);

      cmdlog("Enter a username:");
      new InputListener((command, args, rest) => {
        var full = args.join(" ");
        tmp_newSftp.username = full;
        cmdlog(full);

        cmdlog("Enter a password:");
        document.querySelector("#input input").setAttribute("type", "password");
        new InputListener((command, args, rest) => {
          var full = args.join(" ");
          tmp_newSftp.password = full;
          // cmdlog(full);

          cmdlog("Enter a port: (This is normally 22)");
          document.querySelector("#input input").setAttribute("type", "text");
          new InputListener((command, args, rest) => {
            var full = args.join(" ");
            tmp_newSftp.port = full;
            cmdlog(full);

            cmdlog("Enter a name for the config:");
            new InputListener((command, args, rest) => {
              var full = args.join("_");
              fs.writeFileSync("./connections/"+full+".sftp.json", JSON.stringify(tmp_newSftp));
              cmdlog("Created a new config as " + full);
              ac.enabled = true;

              InputListener.stop();
            });
          });
        });
      });
    });
  }, "Prompts for the creation of a new ``connect`` config.");

  // Connect command
  new Command("connect", async function(command, args) {
    if (args[1]) {
      try {
        sftpData = JSON.parse(fs.readFileSync("./connections/"+args[1]+".sftp.json"));
      } catch (error) {
        logError(error);
        return;
      }
    }
    else {
      try {
        sftpData = JSON.parse(fs.readFileSync("./connections/default.sftp.json"));
      } catch (error) {
        logError("Cannot parse or cannot find a ``default.sftp.json`` file.");
        cmdlog("Create a default config file by using the command ``createconnection`` and naming it ``default``");
        cmdlog("The default config will always be used to connect on startup or by using the command ``connect`` without any arguments");
        cmdlog("Click here to create a config.", "green", () => {
          runCMD("createconnection");
        });
        
      }
    }
    // Fixing any unfilled port.
    if (!sftpData.host) {
      sftpData.host = "127.0.0.1";
    }
    if (!sftpData.port) {
      sftpData.port = 22;
    }
    if (!sftpData.username) {
      sftpData.username = "root";
    }
    if (!sftpData.password) {
      sftpData.password = "";
    }

    let connection;
    try {
      cmdlog("Connecting to "+sftpData.username+"@"+sftpData.host+":"+sftpData.port+"...");
      connection = await sftp.connect(sftpData).then(async function() {
        cDirectory = await sftp.cwd();
      });
    } catch (error) {
      logError(error);
      logError("Trying to reconnect...");
      await sftp.end();
      sftp.on("end", async function(){
        cmdlog("Disconnected from Server");
        runCMD(args.join(" "));
      });
      return error;
    }
    cmdlog("<span style=\"color: green;\">"+sftpData.username+"@"+sftpData.host+"</span>:<span style=\"color: blue;\">"+cDirectory+" $</span> Successfully connected to server.");
    return connection;
  },
    "connect [config_name]<br>"+
    "Start up a connection to a server.<br>"+
    "If a config named ``default`` is present, it'll be used as the startup connection."
  );
  
  // File list command
  new Command(["ls", "list"], async function(cmd, args, rest) {
    try {
      var files = await sftp.list(cDirectory);
      cmdlog(separator(true), false);
      // Sort array alphabetically
      files.sort((a, b) => {
        return a.name.charCodeAt(0) - b.name.charCodeAt(0);
      });
      // Insert go back
      cmdlog("..", false, async function() {
        await runCMD("cd ..");
        await runCMD("ls");
      }, {"class": "dirEnt", "title": "Parent Directory"});
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        var flags = "";
        if (args[2]) {
          flags = args[2];
        }
        if (args[1] && !(new RegExp(args[1], flags).test(file.name))) {
          continue;
        }
        if (file.name.includes(" ")) {
          file.name = "\""+file.name+"\"";
        }
        var filenameOption = file.name;
        if (filenameOption.startsWith("\"") && filenameOption.endsWith("\"")) {
          filenameOption = filenameOption.substring(1, filenameOption.length-1);
        }
        var options = {
          "filename": filenameOption
        };

        var fn = async function() {
          await runCMD("cd "+file.name);
          await runCMD("ls");
        }
        if (file.type == "d") {
          // color = "#4287f5";
          options.oncontextmenu = "directoryCM.show(this);";
          options.class = "dirEnt";
          var dirName = cDirectory+"/"+file.name;
          if (!ac.completions.includes("cd "+dirName+"/")) {
            ac.completions.push("cd "+dirName+"/");
          }
        }
        if (file.type == "-") {
          // color = "lightgrey";
          options.class = "fileEnt";
          var fileName = cDirectory+"/"+file.name;
          if (!ac.completions.includes("get \""+fileName+"\"")) {
            ac.completions.push("get \""+fileName+"\"");
          }
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
          options.oncontextmenu = "directoryCM.show(this);";
          options.class = "linkEnt";
          var dirName = cDirectory+"/"+file.name;
          if (!ac.completions.includes("cd "+dirName+"/")) {
            ac.completions.push("cd "+dirName+"/");
          }
        }

        if (file.type == "-") {
          var bData = bytesTo(file.size);
          options.oncontextmenu = "fileCM.show(this);";
          var _id = cmdlog(file.name + " - " + bData.size+" "+bData.type, false, fn, options);
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
      // logError("Remember to do ``connect`` first.");
    }
  },
    "ls [RegExp] [flags]<br>"+
    "Displays a list of files and folders within the current directory.<br>"+
    "If you insert a Regular expression after the command, it will search for entries matching it.<br>"+
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

  new Command(["get", "download"], async function(cmd, args) {
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

  new Command(["put", "upload"], async function(cmd, args) {
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

  new Command(["putzip", "uploadzip"], async function(cmd, args) {
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

  new Command(["rm", "delete", "remove"], async function(cmd, args) {
    try {
      var options = {
        type: false,
        recursive: false
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

          if (arg == "-R") {
            options.recursive = true;
          }
          unsetArray(args, i);
        }
      }

      if (args[1] && args[1] == "*") {
        var files = await sftp.list(cDirectory);
        var dashArgs = [];
        if (options.recursive) {
          dashArgs.push("-R");
        }

        if (options.type == "d") {
          dashArgs.push("-d");
        }
        else if (options.type == "-") {
          dashArgs.push("-f");
        }
        else if (options.type == "l") {
          dashArgs.push("-l");
        }

        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          if (options.type && file.type != options.type) {
            continue;
          }
          await runCMD("rm "+dashArgs.join(" ")+" \""+file.name+"\"");
        }

        return;
      }

      var file = await getPath(args[1]);
      if (!file.type) {
        logError(`"${file.path}" does not exist.`);
        return;
      }
      else {
        if (options.type != false) {
          if (options.type == file.type) {
            if (file.type == "-" || file.type == "l") {
              var msg = await sftp.delete(file.path);
              cmdlog(msg, "#00ff15");
            }
            else {
              try{
                var msg = await sftp.rmdir(file.path, options.recursive);
                cmdlog(msg, "#00ff15");
              }
              catch {
                logError("Cannot remove directory. Perhaps try to use the parameter \"-R\" for recursive removable. This will remove all files inside the folder if it has any.");
              }
            }
          }
          else {
            logError(`"${file.path}" was of the wrong type "${file.type}", only accepting "${options.type}" with current parameters.`);
          }
          return;
        }
        else{
          try{
            var msg = await sftp.delete(file.path);
            cmdlog(msg, "#00ff15");
          }
          catch {
            try{
              var msg = await sftp.rmdir(file.path, options.recursive);
              cmdlog(msg, "#00ff15");
            }
            catch {
              logError("Cannot remove directory. Perhaps try to use the parameter \"-R\" for recursive removable. This will remove all files inside the folder if it has any.");
            }
          }
          return;
        }
      }
    } catch (error) {
      logError(error);
    }
  },
    "rm (remote-path) [-d | -f | -l]<br>"+
    "Removes a file or directory from the remote system.<br>"+
    "If you use the ``-d`` argument, it will only attempt to remove directories.<br>"+
    "If you use the ``-f`` argument, it will only attempt to remove files.<br>"+
    "If you use the ``-l`` argument, it will only attempt to remove symbolic links.<br>"+
    "Using a ``*`` as the file to remove, will remove every entry in the current folder. (The parameters above also work with this)"
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

  new Command(["help", "?"], function(cmd, args) {
    if (args[1]) {
      for (let i = 0; i < cmdList.length; i++) {
        const cmdItem = cmdList[i];
        if (cmdItem.multi)
        {
          for (let i2 = 0; i2 < cmdItem.command.length; i2++) {
            const _cmd = cmdItem.command[i2];
            if (_cmd.toLowerCase() == args[1].toLowerCase()) {
              return cmdItem.getHelp();
            }
          }
        }
        else if (cmdItem.command.toLowerCase() == args[1].toLowerCase()) {
          return cmdItem.getHelp();
        }
      }
    }
    else {
      const info = {};
      for (let i = 0; i < cmdList.length; i++) {
        const cmdItem = cmdList[i];
        var displayName = cmdItem.command;
        if (cmdItem.multi) {
          displayName = displayName.join(" | ");
        }
        cmdlog(displayName+":");
        info[displayName] = cmdItem.getHelp();
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
      sftpData = default_sftpData;
      toggleCMD();
    });
  }, "Terminates the connection.");

  new Command("autocompletes", function() {
    for (let i = 0; i < ac.completions.length; i++) {
      const _ac = ac.completions[i];
      cmdlog(_ac, "white", () => {
        document.querySelector("div#input input").value = _ac;
        document.querySelector("div#input input").focus();
      });
    }
  }, "Displays all the current available autocompletions.");

  new Command(["restart", "reload"], function() {
    location.reload();
  },
  "Restarts the software.");

  new Command("mkdir", async function(command, args) {
    try {
      if (args.length == 1) {
        this.getHelp();
      }
      else if (args.length > 1) {
        var options = {
          recursive: false
        }
        // Check parameters
        var t_args = args;
        for (let i = 0; i < t_args.length; i++) {
          const arg = t_args[i];
          if (arg.startsWith("-") && arg.length == 2) {
            if (arg == "-R") {
              options.recursive = true;
            }
            unsetArray(args, i);
          }
        }
        if (args[1]) {
          cmdlog(await sftp.mkdir((await getPath(args[1])).path, options.recursive));
        }
        else {
          this.getHelp();
        }
      }
    }
    catch (error) {
      logError(error);
    }
  },
  "mkdir (directory_name) [-R]<br>"+
  "Creates a new directory on the remote machine.<br>"+
  "``-R`` will create the directory recursively, so it will be created even if it's parent directories doesn't exist.");
}

// Add every raw command automatically to autocomplete.
for (let i = 0; i < cmdList.length; i++) {
  const cmdElm = cmdList[i];
  var toCheck = "";
  if (!cmdElm.multi) {
    toCheck = cmdElm.command;
  }
  else {
    toCheck = cmdElm.command[0];
  }
  var index = ac.completions.indexOf(toCheck);
  if (index < 0) {
    ac.completions.push(toCheck);
  }
}

// Add each command to a help autocomplete.
for (let i = 0; i < cmdList.length; i++) {
  const cmdElm = cmdList[i];
  if (cmdElm.multi) {
    for (let i2 = 0; i2 < cmdElm.command.length; i2++) {
      const cmdString = cmdElm.command[i2];
      ac.completions.push("help "+cmdString);
      ac.completions.push("? "+cmdString);
    }
  }
  else {
    ac.completions.push("help "+cmdElm.command);
    ac.completions.push("? "+cmdElm.command);
  }
}

/**
 * Makes the currently clickable text unclickable.
 */
function resetClickables()
{
  var _clickables = document.querySelectorAll("[clickable]");
  for (let i = 0; i < _clickables.length; i++) {
    const elm = _clickables[i];
    elm.toggleAttribute("clickable", false);
    elm.removeAttribute("onclick");
    delete funcs[elm.id];
  }
}


class InputListener
{
  /**
   * Create a new InputListener
   * @param {(this: InputListener, command: string, args: string[], rest: string, clickReset: boolean) => any} fn The function to execute on the input.
   */
  constructor(fn) {
    /**
     * The function to execute on the input.
     */
    this.fn = fn;

    InputListener.activeListener = this;
  }

  /**
   * Clear/Stop the Active Listener.
   */
  clearListener() {
    InputListener.clearListener();
  }

  /**
   * Clear/Stop the Active Listener.
   */
  stop() {
    InputListener.clearListener();
  }

  /**
   * Clear/Stop the Active Listener.
   */
  static stop() {
    InputListener.clearListener();
  }
  
  /**
   * Clear/Stop the Active Listener.
   */
  static clearListener() {
    InputListener.activeListener = undefined;
  }

  /**
   * @type {InputListener}
   */
  static activeListener;
}

/**
 * Run a command based on a string.
 * @param {string} command Command string to run.
 */
async function runCMD(command, clickReset = true)
{
  // Reset clickables
  if (clickReset) {
    resetClickables();
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
  
  cmdInput.value = "";
  if (InputListener.activeListener instanceof InputListener) {
    InputListener.activeListener.fn(command, args, rest, clickReset);
    return;
  }
  
  cmdlog("<span style=\"color: green;\">"+sftpData.username+"@"+sftpData.host+"</span>:<span style=\"color: blue;\">"+cDirectory+" $ </span> "+fullCommand);
  cmdInput.setAttribute("disabled", true);
  
  for (let i = 0; i < cmdList.length; i++) {
    const cmd = cmdList[i];
    var testCommand = cmd.command;
    if (cmd.multi) {
      for (let i2 = 0; i2 < testCommand.length; i2++) {
        var possibleTestCommand = testCommand[i2];
        if (possibleTestCommand == command) {
          testCommand = testCommand[i2];
          break;
        }
      }
    }
    if (testCommand == command) {
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
 * @param {() => void |string|false} onclickFN
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
  return id;
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
  console.error(text);
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
    clearLog();
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
 * Removes a value from an array directly.
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

/**
 * @type {{ string: () => void }}
 */
const funcs = {
}

// Run at start
setTimeout(async () => {
  clearLog();
  await runCMD("connect");
}, 100);

