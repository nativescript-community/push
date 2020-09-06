/**
 * iOS Utils file
 */

import { getClass } from '@nativescript/core/utils/types';

// export function invokeOnRunLoop  (() => {
//     const runloop = CFRunLoopGetMain();
//     return (func) => {
//         CFRunLoopPerformBlock(runloop, kCFRunLoopDefaultMode, func);
//         CFRunLoopWakeUp(runloop);
//     };
// })();

const runloop = CFRunLoopGetMain();
export function invokeOnRunLoop(func) {
    CFRunLoopPerformBlock(runloop, kCFRunLoopDefaultMode, func);
    CFRunLoopWakeUp(runloop);
}

export function toJsObject(objCObj) {
    if (objCObj === null || typeof objCObj !== 'object') {
        return objCObj;
    }
    let node, key, i, l;
    const oKeyArr = objCObj.allKeys;

    if (oKeyArr === undefined && objCObj.count !== undefined) {
        // array
        node = [];
        for (i = 0, l = objCObj.count; i < l; i++) {
            key = objCObj.objectAtIndex(i);
            node.push(toJsObject(key));
        }
    } else if (oKeyArr !== undefined) {
        // object
        node = {};
        for (i = 0, l = oKeyArr.count; i < l; i++) {
            key = oKeyArr.objectAtIndex(i);
            const val = objCObj.valueForKey(key);

            // Firestore can store nulls
            if (val === null) {
                node[key] = null;
                continue;
            }
            node[key] = getValueForClass(val);
        }
    } else {
        node = getValueForClass(objCObj);
    }

    return node;
}

function getValueForClass(val) {
    switch (getClass(val)) {
        case 'NSArray':
        case 'NSMutableArray':
            return toJsObject(val);
        case 'NSDictionary':
        case 'NSMutableDictionary':
            return toJsObject(val);
        case 'String':
            return String(val);
        case 'Boolean':
            return val;
        case 'Number':
        case 'NSDecimalNumber':
            return Number(String(val));
        case 'Date':
            return new Date(val);
        default:
            return String(val);
    }
}
