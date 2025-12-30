
export function beforeTargetFunction(arg) {
    return [`Modified: ${arg}`];
}

export function afterAnotherFunction(result) {
    return `${result} - Modified`;
}
