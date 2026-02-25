module.exports = {
    apps: [{
        name: "fund.pvpai.xyz",
        script: "npm",
        args: "run start",
        env: {
            PORT: 3000,
            NODE_ENV: "production"
        },
        instances: 1,
        exec_mode: "fork",
        autorestart: true,
        watch: false,
        max_memory_restart: "1G",
        log_date_format: "YYYY-MM-DD HH:mm:ss",
        merge_logs: true
    }]
}