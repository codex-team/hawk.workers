module.exports = {
    "env": {
        "es6": true,
        "node": true,
        "jest": true
    },
    "extends": ["codex"],
    "rules": {
        "object-curly-newline": [
            "error", 
            { "minProperties": 2 }
        ]
    }
};