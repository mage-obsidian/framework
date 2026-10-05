
export function beforeTargetFunction(subject, arg) {
    return [`Modified: ${arg}`];
}

export function afterAnotherFunction(subject, result) {
    return `${result} - Modified`;
}

export function beforeDefault(subject) {
    return ['Default Modified'];
}

