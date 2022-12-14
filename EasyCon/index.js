"nodejs";
const usbserial = require('../usbserial');
const fs = require('fs');
let debug = true;
let serial = null;
function easylog(str) {
    if (debug) {
        console.log(str);
    }
}
const SwitchStick = {
    STICK_MIN: 0,
    STICK_CENMIN: 64,
    STICK_CENTER: 128,
    STICK_CENMAX: 192,
    STICK_MAX: 255,
}
// SwitchButton
const SwitchButton = {
    NONE: [0, 0],
    Y: [0x00, 0x01],
    B: [0x00, 0x02],
    A: [0x00, 0x04],
    X: [0x00, 0x08],
    L: [0x00, 0x10],
    R: [0x00, 0x20],
    ZL: [0x00, 0x40],
    ZR: [0x00, 0x80],
    MINUS: [0x01, 0x00],
    PLUS: [0x02, 0x00],
    LCLICK: [0x04, 0x00],
    RCLICK: [0x08, 0x00],
    HOME: [0x10, 0x00],
    CAPTURE: [0x20, 0x00],
}
const SwitchHAT = {
    TOP: 0x00,
    TOP_RIGHT: 0x01,
    RIGHT: 0x02,
    BOTTOM_RIGHT: 0x03,
    BOTTOM: 0x04,
    BOTTOM_LEFT: 0x05,
    LEFT: 0x06,
    TOP_LEFT: 0x07,
    CENTER: 0x08,
}

const DirectionKey = {
    None: 0x0,
    Up: 0x1,
    Down: 0x2,
    Left: 0x4,
    Right: 0x8,
}

const Command = {
    Ready: 0xA5,
    Debug: 0x80,
    Hello: 0x81,
    Flash: 0x82,
    ScriptStart: 0x83,
    ScriptStop: 0x84,
    Version: 0x85,
    LED: 0x86,
    UnPair: 0x87,
    ChangeControllerMode: 0x88,
    ChangeControllerColor: 0x89,
    SaveAmiibo: 0x90,
    ChangeAmiiboIndex: 0x91,
}

const Reply = {
    Error: 0x0,
    Busy: 0xFE,
    Ack: 0xFF,
    Hello: 0x80,
    FlashStart: 0x81,
    FlashEnd: 0x82,
    ScriptAck: 0x83,
}
const ReplyToStr = {
    0x0: "Error",
    0xFE: "Busy",
    0xFF: "Ack",
    0x80: "Hello",
    0x81: "FlashStart",
    0x82: "FlashEnd",
    0x83: "ScriptAck",
}
function CodeFromKey(button = SwitchButton.NONE, hat = SwitchHAT.CENTER, lx = SwitchStick.STICK_CENTER, ly = SwitchStick.STICK_CENTER, rx = SwitchStick.STICK_CENTER, ry = SwitchStick.STICK_CENTER) {
    serialized = [button[0], button[1], hat, lx, ly, rx, ry];
    return CodeFromSerialized(serialized);
}
function ReserveByte(c) {
    let newc = 0x00;
    for (i = 0; i < 7; i++) {
        newc |= (c & 1);
        newc <<= 1;
        c >>= 1;
    }
    return newc;
}
function CodeFromSerialized(serialized) {
    let n = 0;
    let bits = 0;
    let packet = [];
    for (let i = 0; i < serialized.length; i++) {
        let b = serialized[i];
        n = (n << 8) | b;
        bits += 8;
        while (bits >= 7) {
            bits -= 7;
            packet.push((n >> bits) & 0xFF);
            n &= (1 << bits) - 1;
        }
    }
    packet[packet.length - 1] |= 0x80;
    return packet;
}


const BytesReceiverQueue = [];
function PushBytesReceiver(bs, foo, desc) {
    BytesReceiverQueue.push(
        {
            byte_size: bs,
            commit: foo,
            desc: desc,
        }
    );
}
async function Hello() {
    let hello_checked = false;
    PushBytesReceiver(1, (bytes) => {
        if (Reply.Hello == bytes[0]) {
            hello_checked = true;
            return true;
        }
        return false;
    }, "HelloReceiver");
    usbserial.SerialWriteListAsync(serial, [Command.Ready, Command.Ready, Command.Hello]);
    for (let i = 0; i < 10; i++) {
        if (hello_checked) {
            return hello_checked;
        }
        await new Promise(r => setTimeout(r, 10));
    }
    return hello_checked;
}
async function Version() {
    let version = -10000;
    PushBytesReceiver(1, (bytes) => {
        version = bytes[0];
        return true;
    }, "VersionReceiver");
    usbserial.SerialWriteListAsync(serial, [Command.Ready, Command.Ready, Command.Version]);
    for (let i = 0; i < 10; i++) {
        if (version != -10000) {
            return version;
        }
        await new Promise(r => setTimeout(r, 10));
    }
    return version;
}
async function Report(
    button = SwitchButton.NONE,
    hat = SwitchHAT.CENTER,
    lx = SwitchStick.STICK_CENTER,
    ly = SwitchStick.STICK_CENTER,
    rx = SwitchStick.STICK_CENTER,
    ry = SwitchStick.STICK_CENTER) {
    let ack = false;
    let error_code = -999;
    PushBytesReceiver(1, (bytes) => {
        if (Reply.Ack == bytes[0]) {
            ack = true;
            return true;
        }
        error_code = bytes[0];
        return false;
    }, "ReportAckReceiver");
    usbserial.SerialWriteListAsync(serial, CodeFromKey(button, hat, lx, ly, rx, ry));
    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2));
        if (ack) {
            return ack;
        }
    }
    //easylog("[Report] error_code: " + error_code);
    return ack;
}
// SaveAmiibo index: 0~9  amiibo: intlist
async function SaveAmiibo(index, amiibo) {
    let packetSize = 20;
    for (let i = 0; i < amiibo.length; i += packetSize) {
        let len = Math.min(packetSize, amiibo.length - i);
        let packet = amiibo.slice(i, i + len);
        while (true) {
            let ack = false;
            // ??????Amiibo, ????????????????????????Ack
            PushBytesReceiver(2, (bytes) => {
                if (Reply.Ack == bytes[0] && Reply.Ack == bytes[1]) {
                    ack = true;
                    return true;
                }
                return false;
            }, "SaveAmiiboReceiver");
            usbserial.SerialWriteListAsync(serial,
                [
                    Command.Ready, Command.Ready,
                    (i & 0x7F) & 0xFF, (i >> 7) & 0xFF, (len & 0x7F) & 0xFF, (len >> 7) & 0xFF,
                    index, Command.SaveAmiibo,
                ]);
            usbserial.SerialWriteListAsync(serial, packet);
            for (let j = 0; j < 200; j++) {
                await new Promise(r => setTimeout(r, 5));
                if (ack) {
                    break;
                }
            }
            if (ack) {
                easylog("[SaveAmiibo] packet:" + [i, i + len] + " is saved");
                break;
            }
            usbserial.SerialWriteListAsync(serial, [Command.Ready, Command.Ready]);
        }
    }
    return true;
}
async function ChangeAmiiboIndex(index) {
    let ack = false;
    PushBytesReceiver(1, (bytes) => {
        if (Reply.Ack == bytes[0]) {
            ack = true;
            return true;
        }
        return false;
    }, "ChangeAmiiboReceiver");
    usbserial.SerialWriteListAsync(serial, [Command.Ready, index, Command.ChangeAmiiboIndex]);
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 20));
        if (ack) {
            break;
        }
    }
    return ack;
}

async function ReadIntListFromAmiiboBin(path) {
    let buf = fs.readFileSync(path);
    let ret = [];
    for (let x of buf) {
        ret.push(x);
    }
    return ret;
}
module.exports = {
    SwitchStick: SwitchStick,
    SwitchButton: SwitchButton,
    SwitchHAT: SwitchHAT,
    DirectionKey: DirectionKey,
    Command: Command,
    Reply: Reply,
    ReplyToStr: ReplyToStr,
    CodeFromKey: CodeFromKey,
    CodeFromSerialized: CodeFromSerialized,
    ReserveByte: ReserveByte,
    // ????????????
    // note. ???????????????,???????????????????????????,?????????????????????????????????
    Report: Report,
    Version: Version,
    Hello: Hello,
    ReadIntListFromAmiiboBin: ReadIntListFromAmiiboBin,
    SaveAmiibo: SaveAmiibo,
    SaveAmiiboFromBin: async function (index, path) {
        let bin = await ReadIntListFromAmiiboBin(path);
        return SaveAmiibo(index, bin);
    },
    ChangeAmiiboIndex: ChangeAmiiboIndex,
    // ????????????
    PushBytesReceiver: PushBytesReceiver,
    // ????????????
    SetEasyConSerial: function (ser) {
        serial = ser;
        // reset BytesReceiverQueue
        BytesReceiverQueue.length = 0;
        // serial read callback
        let receiver = null;
        let bytes = [];
        usbserial.SerialReadListAsync(serial, (intList) => {
            for (let i = 0; i < intList.length; i++) {
                let hex = Buffer([intList[i]]);
                if (!receiver && BytesReceiverQueue.length > 0) {
                    receiver = BytesReceiverQueue.shift();
                    easylog("[SerialReadListAsync] " + receiver.desc + " " + receiver.byte_size);
                } else if (!receiver) {
                    easylog("[SerialReadListAsync] received: 0x" + hex.toString('hex') + " " + ReplyToStr[parseInt(hex.toString('hex'), 16)]);
                    continue;
                }
                // ?????????????????????, ???????????????????????????
                receiver.byte_size--;
                bytes.push(parseInt(hex.toString('hex'), 16));
                if (receiver.byte_size == 0) {
                    let ret = receiver.commit(bytes);
                    // ??????????????????, ??????????????????;
                    // ?????????read buffer??? receive queue???????????????, ??????????????????, ?????????????????????
                    if (!ret) {
                        easylog("[SerialReadListAsync] ClearAll: " + BytesReceiverQueue + " " + intList);
                        BytesReceiverQueue.length = 0;
                        bytes.length = 0;
                        receiver = null;
                        break;
                    }
                    bytes.length = 0;
                    receiver = null;
                }
            }
        });
    },
}