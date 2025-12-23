flowControlMode = "";

port = null;
self.onmessage = function (e) {
    if (e.data.mode !== undefined) {
        flowControlMode = e.data.mode //We'll send "hardware" or "software"
        // console.log("Flow controller mode:" + e.data.mode);
    }
    if (e.data.port !== null) {
        port = e.data.port;
    }
}


setInterval(controlFlow, 1);

async function controlFlow() {

    if (port) {
        while (port.readable) {
            if (flowControlMode == "software") {
                const reader = port.readable.getReader();
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) {
                            // |reader| has been canceled.
                            break;
                        }
                        if (value == 0x11) //ctrl+q is 0x11 -> XON, send data
                            self.postMessage({ flowStopped: false });
                        if (value == 0x13) //ctrl+s is 0x13 -> XOFF, stop sending
                            self.postMessage({ flowStopped: true });
                    }
                } catch (error) {
                    // Handle |error|…
                } finally {
                    reader.releaseLock();
                }
            } else if (flowControlMode == "hardware") {
                // console.log("wowowow");
            }
        }
    }
}


