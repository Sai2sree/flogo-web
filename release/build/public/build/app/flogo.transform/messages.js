"use strict";
exports.PUB_EVENTS = {
    selectActivity: {
        channel: 'flogo-transform',
        topic: 'select-task'
    },
    saveTransform: {
        channel: 'flogo-transform',
        topic: 'save-transform'
    },
    deleteTransform: {
        channel: 'flogo-transform',
        topic: 'delete-transform'
    }
};
exports.SUB_EVENTS = {
    selectActivity: {
        channel: 'flogo-transform',
        topic: 'public-select-task'
    },
    saveTransform: {
        channel: 'flogo-transform',
        topic: 'public-save-transform'
    },
    deleteTransform: {
        channel: 'flogo-transform',
        topic: 'public-delete-transform'
    }
};