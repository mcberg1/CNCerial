//Globals:
var fileName = "";
var fileContent;
var modifiedContent = "";
var fileSize = 0;

var serialConfiguration = {
    baudRate: null,
    parity: null,
    stopBits: null,
    dataBits: null,
    XON: null,
    RTS: null,
    DTR: null,
    storage: null
};


var sending = false;
var canSend = false;
var flowStopped = false;
var port;

var trimWhitespace = false;
var trimComments = false;
var trimLineNumbers = false;

var progName = "O1000";
var progRename = "O1000";



flowControlMode = "software"; //default



function runOnLoad() {
    console.log("load");
    var modalElement = document.getElementById('webSerialSupportModal');
    const webSerialSupportModal = bootstrap.Modal.getOrCreateInstance(modalElement);
    const firstTimeModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('firstTimeModal'));
    if (!storageAvailable("localStorage")) {
        alert("Heads up! Local storage isn't supported by this broswer. That's okay, but it means that your settings won't be saved, and we'll think it's always your first time here.");
    }

    if ('serial' in navigator) {
        // Web Serial API is supported.
        console.log("Web Serial API is supported!");
        // Proceed with using the Web Serial API
    } else {
        // Web Serial API is not supported.
        console.log("Web Serial API is not supported.");
        webSerialSupportModal.show();
        return;
        // Display a message to the user or provide an alternative solution
    }
    if (localStorage.getItem("firstTime") == null) {
        firstTimeModal.show();
        localStorage.setItem("firstTime", true);
    }
    checkPortTimer = setInterval(checkPort, 100);
}


function showInfo() {
    const firstTimeModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('firstTimeModal'));
    firstTimeModal.show();
}

const JSONToFile = (obj, filename) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
};



window.onbeforeunload = function () {
    return 'Are you sure you want to leave?';
};

function byteSize(string) {
    return new TextEncoder().encode(string).length;
}


function storageAvailable(type) {
    let storage;
    try {
        storage = window[type];
        const x = "__storage_test__";
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    } catch (e) {
        return (
            e instanceof DOMException &&
            e.name === "QuotaExceededError" &&
            // acknowledge QuotaExceededError only if there's something already stored
            storage &&
            storage.length !== 0
        );
    }
}



if (storageAvailable("localStorage")) {
    // Yippee! We can use localStorage awesomeness
    var temp = localStorage.getItem("serial_config", temp);
    if (temp != null) {
        serialConfiguration = JSON.parse(temp);
        updateSerialFields();
        updateOptions();
        checkReady();
    }
    if (localStorage.getItem("trimWhitespace") != null && localStorage.getItem("trimComments") != null) {
        trimWhitespace = (localStorage.getItem("trimWhitespace") === 'true');
        trimComments = (localStorage.getItem("trimComments") === 'true');
        trimLineNumbers = (localStorage.getItem("trimLineNumbers") === 'true');

        updateOptions();
    }
} else {
    console.log("haha looser no local storage get absolutely ruined");
}





function updateOptions() {
    document.getElementById("trimWhitespaceCheck").checked = trimWhitespace;
    document.getElementById("trimCommentsCheck").checked = trimComments;
    document.getElementById("trimLineNumbersCheck").checked = trimLineNumbers;
    if (fileContent != null) {
        var percentSaved = modifyContent() / byteSize(fileContent) * 100;
        document.getElementById("savedPercentDisplayElement").innerHTML = "Reduced by " + percentSaved.toFixed(1) + "%";
        checkReady();
    }
    else
        document.getElementById("savedPercentDisplayElement").innerHTML = "";
}


function checkPort() { //Add autoconnect
    if (port != null) {
        if (port.connected) {
            // console.log("bro connected)");
            document.getElementById("portNameDisplay").innerHTML = "Port connected";
        }
        else {
            document.getElementById("portNameDisplay").innerHTML = "No port selected";
            port.forget();
        }
    } else {
        document.getElementById("portNameDisplay").innerHTML = "No port selected";
        // port.forget();
    }
}




async function configSerial() {
    console.log("select port");
    const usbVendorId = 0x0403;
    checkPortTimer = setInterval(checkPort, 100);
    if (port != null)
        port.forget();
    // port = await navigator.serial.requestPort({ filters: [{ usbVendorId }] });
    try {
        port = await navigator.serial.requestPort();
    } catch (e) {
        if (e.name == "NotFoundError") {
            port = null;
            checkReady();
        }
        else
            throw (e);
        return;
    }
    await port.open({ baudRate: serialConfiguration.baudRate, bufferSize: 1, dataBit: serialConfiguration.dataBits, flowControl: (serialConfiguration.RTS ? "hardware" : "none"), parity: serialConfiguration.parity.toLowerCase(), stopBits: serialConfiguration.stopBits });


    // console.log(port.connected);
    checkReady();
}


function modifyContent() {
    if (fileContent == null)
        return -1;

    console.log("modify: ");
    var tempContent = fileContent;
    var lines = tempContent.split('\n');
    lines.pop(); //Remove last line, because it is always a blank line
    //Construct modified file contents, so we can update the ammount of data we're sending because i want to
    modifiedContent = "";

    for (var line of lines) {
        if (trimLineNumbers)
            line = line.replaceAll(/^\b[N][0-9]+ /gm, ''); //Trim line numbers, and their following space   
        if (line.charAt(0) != "(" || !trimComments) { //it's not a comment, or we don't care
            if (line.charAt(0) != "(" && trimWhitespace) //Trim whitespace only on non-comment lines
                line = line.replace(/[^\S\r\n]/g, ''); //yeah 
            modifiedContent += line + "\n"; //we'll just go through and re-split it again later because it makes it easier now
        }
    }
    return (byteSize(tempContent) - byteSize(modifiedContent)); //return number of bytes removed
}


















var pStpoped = false;
var index = 0;
var inLoop = false;



setInterval(controlFlow, 1); //hopefully this is fast enough LOL

async function controlFlow() {
    if (port) {
        if (port.readable) {
            if (flowControlMode == "software") {
                try {
                    const reader = port.readable.getReader();

                    const { value, done } = await reader.read();
                    if (value)
                        console.log(value);
                    if (done) {
                        // |reader| has been canceled.
                        return;
                    }
                    if (value == 0x11) { //ctrl+q is 0x11 -> XON, send data
                        flowStopped = false;
                        sendSerial(false);
                    }
                    if (value == 0x13) //ctrl+s is 0x13 -> XOFF, stop sending
                        flowStopped = true;
                    reader.releaseLock();


                } catch (error) {
                    // Handle |error|…
                } finally {
                    // reader.releaseLock();
                }

            } else if (flowControlMode == "hardware") {
                // console.log("wowowow");
            }
        }
    }
}




async function sendSerial(fromButton) {

    if (!sending && !fromButton) //Flow control called it, but we're not currently sending
        return;
    if (sending && !fromButton) { //do this on call from flow control after sending
        if (inLoop)
            return;
    }
    else { //do this on call from button
        index = 0;
        if (serialConfiguration.storage <= fileSize) {
            //Let the user know that the file is too big, so the machine should be in drip feed.
            //Give the option to cancel or continue
            if (!confirm("File is larger than machine storage! This is okay for drip feed, but flow control must be set correctly."))
                return;
        }
        console.log("send");
        //Set all the children to locked:
        const parentDiv = document.getElementById("mainMenu");
        for (const child of parentDiv.children) {
            child.classList.add('locked');
        }

        document.getElementById("cancelButton").classList.remove("d-none", "locked");
        modifyContent();
        if (progName != progRename) { //I think this dont work too well ngl so fixx plsss
            modifiedContent = modifiedContent.replace(progName, progRename);
        }
        sending = true;
    }



    //do this every time
    const encoder = new TextEncoder();
    const writer = port.writable.getWriter();


    sizeDisplayElement = document.getElementById("fileSizeDisplay")
    var lines = modifiedContent.split('\n');
    var numLines = lines.length;

    while (index < numLines) {
        inLoop = true;
        if (!sending)
            break; //This will update if we cancel, and run the remaining code in this function call


        if (flowStopped) { //We will cancel the loop, knowing flow control will call it again, and we'll resume.
            writer.releaseLock();
            inLoop = false;
            return; //skip the rest of the code in this function too
        }
        line = lines[index];
        await writer.write(encoder.encode(line + '\n')); //send the line
        index++; //update the index globally, so we remember where we left off
        sizeDisplayElement.innerHTML = index + " / " + numLines + " lines <br>" + ((10000 * index / numLines) / 100).toFixed(2) + "%";
    }
    writer.releaseLock();

    document.getElementById("cancelButton").classList.add("d-none");
    const parentDiv = document.getElementById("mainMenu");
    for (const child of parentDiv.children)
        child.classList.remove('locked');

    sending = false;
    inLoop = false;
    // done(); //play sound maybe
    checkReady();
}

function cancelSending(warn = false) {
    if (warn)
        if (!confirm("Cancel sending?"))
            return;
    sending = false;
    index = 0; //update this so we can be sure no wierdness happens with flow control.
    document.getElementById("cancelButton").classList.add("d-none"); //This doesn't get triggered if we cancel while in a flow control hold.
    const parentDiv = document.getElementById("mainMenu");

    for (const child of parentDiv.children)
        child.classList.remove('locked');

    sending = false;
    inLoop = false;
    checkReady();

}

function setBaud(rate) {
    serialConfiguration.baudRate = rate;
    baudDisplayElement = document.getElementById("baudDisplayElement")
    baudDisplayElement.innerHTML = rate + " bps";
    checkReady();
    // alert(rate);
}

function openFile() {
    console.log("open");
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = ".nc, .json"
    sizeDisplayElement = document.getElementById("fileSizeDisplay")
    fileNameDisplayElement = document.getElementById("fileNameDisplay")
    input.onchange = e => {
        // getting a hold of the file reference
        var file = e.target.files[0];
        // setting up the reader

        if (file.name.includes(".nc")) {
            fileNameDisplayElement.innerHTML = file.name;
            fileSize = file.size;
        }

        var reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        // here we tell the reader what to do when it's done reading...
        reader.onload = readerEvent => {
            var content = readerEvent.target.result; // this is the content!
            if (file.name.includes(".nc")) {
                fileContent = content;//.split('\n');
                progName = fileContent.split("O")[1].split('\n')[0]; //Get first instance of O command, usually signifies name, might not always work tbh
                progRename = progName;
                document.getElementById("renameInput").placeholder = progName;;
                updateOptions();
                checkReady();
            }
            else {
                serialConfiguration = JSON.parse(content);
                updateSerialFields();
            }
            // console.log(content);
            checkReady();
        }
    }
    input.click();
}

function updateSerialFields() {
    setBaud(serialConfiguration.baudRate);
    setParity(serialConfiguration.parity);
    setStopBits(serialConfiguration.stopBits);
    setDataBits(serialConfiguration.dataBits);
    setStorage(serialConfiguration.storage);
    setFlowControl(serialConfiguration.RTS);
    localStorage.setItem("serial_config", JSON.stringify(serialConfiguration));
}



function setStorage(storage) {
    element = document.getElementById("storageInput");
    serialConfiguration.storage = storage;
    exponent = 0;
    element.innerHTML = "bytes";
    //get exponent
    if (storage > (10 ** 3)) {
        exponent = 3;
        element.innerHTML = "kBytes";
    }

    if (storage > (10 ** 6)) {
        exponent = 6;
        element.innerHTML = "MBytes";
    }
    if (storage > (10 ** 9)) {
        exponent = 9;
        element.innerHTML = "GBytes";
    }
    document.getElementById("storageInputValue").value = (Math.round((1 * storage) / (10 ** exponent)) / 1); //2 decimals 
    checkReady();
}



function setDataBits(bits) {
    serialConfiguration.dataBits = bits;
    dataBitsDisplayElement = document.getElementById("dataBitsDisplayElement");
    dataBitsDisplayElement.innerHTML = bits;
    checkReady();
}

function setParity(parityType) {
    serialConfiguration.parity = parityType;
    parityDisplayElement = document.getElementById("parityDisplayElement");
    parityDisplayElement.innerHTML = parityType;
    checkReady();
}

function setStopBits(bits) {
    serialConfiguration.stopBits = bits;
    stopBitsDisplayElement = document.getElementById("stopBitsDisplayElement");
    stopBitsDisplayElement.innerHTML = bits;
    checkReady();
}


function setFlowControl(val) {
    serialConfiguration.XON = !val;
    serialConfiguration.RTS = val;
    flowControlDisplayElement = document.getElementById("flowControlDisplayElement");
    flowControlDisplayElement.innerHTML = !val ? "Software (XON/XOFF)" : "Hardware (RTS)";
    flowControlMode = (!val ? "software" : "hardware");
    console.log("?");
    checkReady();
}

function changeStorageUnits() {
    element = document.getElementById("storageInput");
    current = element.innerHTML;
    console.log(current);
    exponent = 0;
    if (current == "bytes") {
        element.innerHTML = "kBytes";
        exponent = 3;
    }
    else if (current == "kBytes") {
        element.innerHTML = "MBytes";
        exponent = 6;
    }
    else if (current == "MBytes") {
        element.innerHTML = "GBytes";
        exponent = 9;
    }
    else if (current == "GBytes") {
        element.innerHTML = "bytes";
        exponent = 0;
    }

    serialConfiguration.storage = (10 ** exponent) * document.getElementById("storageInputValue").value;
    console.log(serialConfiguration.storage)
    checkReady();
}

function updateStorageVal() {
    element = document.getElementById("storageInput");
    current = element.innerHTML;
    exponent = 0;
    if (current == "kBytes")
        exponent = 3;
    else if (current == "MBytes")
        exponent = 6;
    else if (current == "GBytes")
        exponent = 9;
    serialConfiguration.storage = (10 ** exponent) * document.getElementById("storageInputValue").value;
    checkReady();
}


function checkReady() {
    localStorage.setItem("serial_config", JSON.stringify(serialConfiguration));
    var serialConfigured = false;
    canSend = false;
    if (serialConfiguration.baudRate > 0 && serialConfiguration.parity != null && serialConfiguration.stopBits != null && serialConfiguration.dataBits != null) {
        serialConfigured = true;
        document.getElementById('serialDisplayElement').innerHTML = 'Serial Configured';
    }
    if (modifyContent() != -1)
        fileSize = byteSize(modifiedContent);
    if (fileSize > 0 && port != null && serialConfigured) {
        document.getElementById("sendButton").classList.remove("locked");
        sizeDisplayElement = document.getElementById("fileSizeDisplay");
        if (fileSize < 1024)
            sizeDisplayElement.innerHTML = Math.round(fileSize) + " Bytes";
        else
            sizeDisplayElement.innerHTML = Math.round(fileSize / 102.4) / 10 + " kB";
        canSend = true;
    }
    else
        document.getElementById("sendButton").classList.add("locked");

}

function saveConfig() {

    JSONToFile(serialConfiguration, "NCerial_config");
    localStorage.setItem("serial_config", JSON.stringify(serialConfiguration));
}


function check(e) {
    const optionsModal = bootstrap.Modal.getInstance(document.getElementById('optionsModal'));
    if (e.key === "Enter") {
        // alert("bro");
        optionsModal.toggle();
    }
}


document.getElementById("renameInput").addEventListener('input', getNewName);
function getNewName() {
    // console.log(document.getElementById("renameInput").value);   
    progRename = document.getElementById("renameInput").value;
}

document.getElementById("trimWhitespaceCheck").addEventListener('input', getTrimWhitespace);
function getTrimWhitespace() {
    trimWhitespace = document.getElementById("trimWhitespaceCheck").checked;
    localStorage.setItem("trimWhitespace", trimWhitespace);
    localStorage.setItem("trimComments", trimComments);
    localStorage.setItem("trimLineNumbers", trimLineNumbers);
    updateOptions()
}

document.getElementById("trimCommentsCheck").addEventListener('input', getTrimComments);
function getTrimComments() {
    trimComments = document.getElementById("trimCommentsCheck").checked;
    localStorage.setItem("trimWhitespace", trimWhitespace);
    localStorage.setItem("trimComments", trimComments);
    localStorage.setItem("trimLineNumbers", trimLineNumbers);
    updateOptions()
}

document.getElementById("trimLineNumbersCheck").addEventListener('input', getTrimLineNumbers);
function getTrimLineNumbers() {
    trimLineNumbers = document.getElementById("trimLineNumbersCheck").checked;
    localStorage.setItem("trimLineNumbers", trimLineNumbers);
    localStorage.setItem("trimWhitespace", trimWhitespace);
    localStorage.setItem("trimComments", trimComments);
    updateOptions()
}
