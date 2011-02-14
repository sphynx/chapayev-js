APP_ROOT = "/home/sphynx/js"

God.pid_file_directory = "#{APP_ROOT}/pids"

God.watch do |w|
    w.name = "chapayev"
    w.interval = 5.seconds # default
    w.start = "env node #{APP_ROOT}/server.js"
    w.stop = "env killall node"
    w.start_grace = 10.seconds
    w.restart_grace = 10.seconds
    w.log = "#{APP_ROOT}/log/chapayev.log"

    w.start_if do |start|
      start.condition(:process_running) do |c|
        c.interval = 5.seconds
        c.running = false
      end
    end
end
