"nodejs";

const $java = $autojs.java;
require('rhino').install();
const { showToast } = require('toast');
const UsbManager = android.hardware.usb.UsbManager;
const UsbDevice = android.hardware.usb.UsbDevice;
const UsbConstants = android.hardware.usb.UsbConstants;
const UsbDeviceConnection = android.hardware.usb.UsbDeviceConnection;
const UsbEndpoint = android.hardware.usb.UsbEndpoint;
const UsbInterface = android.hardware.usb.UsbInterface;
const PendingIntent = android.app.PendingIntent;
const IntentFilter = android.content.IntentFilter;
const Intent = android.content.Intent;
// TODO receive broadcast
// const BroadcastReceiver = android.content.BroadcastReceiver;
const ACTION_USB_PERMISSION = "com.android.usb.USB_PERMISSION";
let UsbSerialDevice = null;
let UsbSerialInterface = null;
let UsbManagerService = context.getSystemService("usb");

let DATA_BITS_5 = 5;
let DATA_BITS_6 = 6;
let DATA_BITS_7 = 7;
let DATA_BITS_8 = 8;
let PARITY_NONE = 0;
let PARITY_ODD = 1;
let PARITY_EVEN = 2;
let PARITY_MARK = 3;
let PARITY_SPACE = 4;
let FLOW_CONTROL_OFF = 0;
let FLOW_CONTROL_RTS_CTS = 1;
let FLOW_CONTROL_DSR_DTR = 2;
let FLOW_CONTROL_XON_XOFF = 3;

// ListToBytes JS int list to java.lang.Byte[]
function ListToBytes(bytes) {
    let ret = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        ret[i] = bytes[i];
    }
    return ret;
}
// BytesToList java.lang.Byte[] to JS int list
function BytesToList(bytes) {
    let ret = [];
    for (let i = 0; i < bytes.length; i++) {
        ret.push(bytes[i]);
    }
    return ret;
}
// ListToString JS int list to JS string
function ListToString(bytes) {

}
// TryRequestUSBPermission .
function TryRequestUSBPermission(device) {
    pendingIntent = PendingIntent.getBroadcast(context, 0, new Intent(ACTION_USB_PERMISSION), 0);
    filter = new IntentFilter(ACTION_USB_PERMISSION);
    filter.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
    filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
    UsbManagerService.requestPermission(device, pendingIntent); // 该代码执行后，系统弹出一个对话框/等待权限
}
// GetSerialDevices .
async function GetSerialDevices(dexpath = "./usbserial/usbserial.dex") {
    // load dex
    if (!UsbSerialDevice || !UsbSerialInterface) {
        await $java.loadDex(dexpath);
        UsbSerialDevice = com.felhr.usbserial.UsbSerialDevice;
        UsbSerialInterface = com.felhr.usbserial.UsbSerialInterface;
    }
    let devices = UsbManagerService.getDeviceList();
    if (devices.isEmpty()) {
        console.log("[GetSerialDevices] USB Device Not Found");
        return null;
    }
    let deviceNames = devices.keySet();
    let ret = {}
    for (var itr = deviceNames.iterator(); itr.hasNext();) {
        let deviceName = itr.next();
        let device = devices.get(deviceName);
        if (UsbSerialDevice.isSupported(device)) {
            ret[device.getDeviceName()] = {
                "vendor_id": device.getVendorId(),
                "product_id": device.getProductId(),
                "product_name": device.getProductName(),
            }
        }
    }
    return ret;
}
// ConnectTo .
async function ConnectTo(baudRate = 115200, dataBits = DATA_BITS_8, parity = PARITY_NONE, flowctrl = FLOW_CONTROL_OFF, devpath = null, dexpath = "./usbserial/usbserial.dex") {
    // load dex
    if (!UsbSerialDevice || !UsbSerialInterface) {
        await $java.loadDex(dexpath);
        UsbSerialDevice = com.felhr.usbserial.UsbSerialDevice;
        UsbSerialInterface = com.felhr.usbserial.UsbSerialInterface;
    }
    let devices = UsbManagerService.getDeviceList();
    if (devices.isEmpty()) {
        console.log("[ConnectTo] USB Device Not Found");
        return null;
    }
    let deviceNames = devices.keySet();
    console.log("[ConnectTo] devices: " + deviceNames);
    let targets = []
    for (var itr = deviceNames.iterator(); itr.hasNext();) {
        let deviceName = itr.next();
        let device = devices.get(deviceName);
        if (UsbSerialDevice.isSupported(device) && (!devpath || devpath == device.getDeviceName())) {
            targets.push(device);
            console.log("[ConnectTo] serial device: " + device.getVendorId() + ":" + device.getProductId() + " | " + device.getDeviceName() + " | " + device.getProductName());
        }
    }
    if (targets.length == 0) {
        return null;
    }
    let serial = targets[0];
    console.log("[ConnectTo] serial: " + serial.getDeviceName());
    // 弹窗请求权限
    TryRequestUSBPermission(serial);
    // 10s内确认
    let usbConn = null;
    for (let i = 0; i < 100; i++) {
        await new Promise(r => setTimeout(r, 100));
        usbConn = UsbManagerService.openDevice(serial);
        if (usbConn) {
            break;
        }
    }
    if (!usbConn) {
        return null;
    }
    serial = UsbSerialDevice.createUsbSerialDevice(serial, usbConn);
    serial.open();
    serial.setBaudRate(115200);
    serial.setDataBits(dataBits);
    serial.setParity(parity);
    serial.setFlowControl(flowctrl);
    return serial;
}
// SerialWriteListAsync .
function SerialWriteListAsync(serial, intList) {
    serial.write(ListToBytes(intList));
}
// SerialWriteList .
function SerialWriteList(serial, intList, timeout = 1000) {
    return serial.syncWrite(ListToBytes(intList), timeout);
}
// SerialReadListAsync .
function SerialReadListAsync(serial, callback) {
    serial.read($java.wrap({
        onReceivedData: (bytes) => {
            callback(BytesToList(bytes));
        },
    }, false));
}
module.exports = {
    ConnectTo: ConnectTo,
    GetSerialDevices: GetSerialDevices,
    SerialWriteListAsync: SerialWriteListAsync,
    SerialWriteList: SerialWriteList,
    SerialReadListAsync: SerialReadListAsync,
}