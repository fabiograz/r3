package main

import (
	"bufio"
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"r3/activation"
	"r3/bruteforce"
	"r3/cache"
	"r3/cert"
	"r3/config"
	"r3/db"
	"r3/db/embedded"
	"r3/db/initialize"
	"r3/db/upgrade"
	"r3/handler/cache_download"
	"r3/handler/csv_download"
	"r3/handler/csv_upload"
	"r3/handler/data_access"
	"r3/handler/data_auth"
	"r3/handler/data_download"
	"r3/handler/data_upload"
	"r3/handler/icon_upload"
	"r3/handler/ics_download"
	"r3/handler/license_upload"
	"r3/handler/transfer_export"
	"r3/handler/transfer_import"
	"r3/handler/websocket"
	"r3/log"
	"r3/login"
	"r3/scheduler"
	"r3/tools"
	"strings"
	"time"

	_ "time/tzdata" // to embed timezone DB

	"github.com/kardianos/service"
)

var (
	// overwritten by build parameters
	appName      string = "REI3"
	appNameShort string = "R3"
	appVersion   string = "0.1.2.3"

	// embed static web files
	//go:embed www/*
	fsStatic embed.FS
)

type cliInput struct {
	adminCreate      string
	configFile       string
	dynamicPort      bool
	http             bool
	open             bool
	run              bool
	serviceName      string
	serviceStart     bool
	serviceStop      bool
	serviceInstall   bool
	serviceUninstall bool
	setData          string
	wwwPath          string
}
type program struct {
	cli             cliInput
	embeddedDbOwned bool           // this instance has started the embedded database
	logger          service.Logger // logs to the operating system if called as service, otherwise to stdOut
	stopping        bool
	webServer       *http.Server
}

func main() {

	// set configuration parameters
	config.SetAppVersion(appVersion)
	config.SetAppName(appName, appNameShort)

	// process configuration overwrites from command line
	var cli cliInput
	flag.StringVar(&cli.adminCreate, "newadmin", "", "Create new admin user (username:password), password must not contain spaces or colons")
	flag.StringVar(&cli.configFile, "config", "config.json", "Location of configuration file (combined with -run)")
	flag.BoolVar(&cli.dynamicPort, "dynamicport", false, "Start with a port provided by the operating system (combined with -run)")
	flag.BoolVar(&cli.http, "http", false, "Start with HTTP (not encrypted, for testing/development only, combined with -run)")
	flag.BoolVar(&cli.open, "open", false, fmt.Sprintf("Open URL of %s in default browser (combined with -run)", appName))
	flag.BoolVar(&cli.run, "run", false, fmt.Sprintf("Run %s from within this console (see 'config.json' for configuration)", appName))
	flag.BoolVar(&cli.serviceInstall, "install", false, fmt.Sprintf("Install %s service", appName))
	flag.StringVar(&cli.serviceName, "servicename", appName, "Specify name of service to manage (to (un)install, start or stop service)")
	flag.BoolVar(&cli.serviceStart, "start", false, fmt.Sprintf("Start %s service", appName))
	flag.BoolVar(&cli.serviceStop, "stop", false, fmt.Sprintf("Stop %s service", appName))
	flag.BoolVar(&cli.serviceUninstall, "uninstall", false, fmt.Sprintf("Uninstall %s service", appName))
	flag.StringVar(&cli.setData, "setdata", "", "Write to config file: Data directory (platform files and database if stand-alone)")
	flag.StringVar(&cli.wwwPath, "wwwpath", "", "(Development) Use web files from given path instead of embedded ones")
	flag.Parse()

	// define service and service logger
	svcDisplay := fmt.Sprintf("%s platform", appName)
	if cli.serviceName != appName {
		svcDisplay = fmt.Sprintf("%s platform (%s)", appName, cli.serviceName)
	}

	svcConfig := &service.Config{
		Name:        strings.ToLower(cli.serviceName),
		DisplayName: svcDisplay,
		Description: fmt.Sprintf("Provides the %s platform components", appName),
	}

	// initialize service
	var err error
	prg := &program{}
	prg.cli = cli
	prg.stopping = false

	svc, err := service.New(prg, svcConfig)
	if err != nil {
		fmt.Printf("service could not be created, error: %v\n", err)
		return
	}

	prg.logger, err = svc.Logger(nil)
	if err != nil {
		fmt.Printf("service logger could not be created, error: %v\n", err)
		return
	}

	// get path for executable
	app, err := os.Executable()
	if err != nil {
		prg.logger.Error(err)
		return
	}

	// change working directory to executable path
	if err := os.Chdir(filepath.Dir(app)); err != nil {
		prg.logger.Error(err)
		return
	}

	// print usage info if interactive and no arguments were added
	if service.Interactive() && len(os.Args) == 1 {
		fmt.Printf("Available parameters:\n")
		flag.PrintDefaults()

		fmt.Printf("\n################################################################################\n")
		fmt.Printf("This is the executable of %s, the open application platform, v%s\n", appName, appVersion)
		fmt.Printf("Copyright (c) 2019-2021 Gabriel Victor Herbert\n\n")
		fmt.Printf("%s can be installed as service (-install) or run from the console (-run).\n\n", appName)
		fmt.Printf("When %s is running, use any modern browser to access it (port 443 by default).\n\n", appName)
		fmt.Printf("For installation instructions, please refer to the included README file or visit\n")
		fmt.Printf("https://rei3.de/admindocu-en_us/ for the full admin documentation.\n")
		fmt.Printf("################################################################################\n\n")

		// wait for user input to keep console open
		fmt.Printf("See above for available parameters. Press enter to return.\n")

		reader := bufio.NewReader(os.Stdin)
		reader.ReadString('\n')
		return
	}

	// load configuration from file
	config.SetConfigFilePath(cli.configFile)

	if err := config.LoadFile(); err != nil {
		prg.logger.Errorf("failed to read configuration file, %v", err)
		return
	}

	// other cli arguments
	if cli.serviceInstall {
		if err := svc.Install(); err != nil {
			prg.logger.Error(err)
			return
		}
		prg.logger.Info("service was successfully installed")
		return
	}
	if cli.serviceUninstall {
		if err := svc.Uninstall(); err != nil {
			prg.logger.Error(err)
			return
		}
		prg.logger.Info("service was successfully uninstalled")
		return
	}
	if cli.serviceStart {
		if err := svc.Start(); err != nil {
			prg.logger.Error(err)
			return
		}
		prg.logger.Info("service was successfully started")
		return
	}
	if cli.serviceStop {
		if err := svc.Stop(); err != nil {
			prg.logger.Error(err)
			return
		}
		prg.logger.Info("service was successfully stopped")
		return
	}
	if cli.dynamicPort {
		config.File.Web.Port = 0
	}
	if cli.setData != "" {

		config.File.Paths.Certificates = filepath.Join(cli.setData, "certificates")
		config.File.Paths.EmbeddedDbData = filepath.Join(cli.setData, "database")
		config.File.Paths.Files = filepath.Join(cli.setData, "files")
		config.File.Paths.Temp = filepath.Join(cli.setData, "temp")
		config.File.Paths.Transfer = filepath.Join(cli.setData, "transfer")

		if err := config.WriteFile(); err != nil {
			prg.logger.Errorf("failed to write configuration file, %v", err)
		}
		return
	}

	// main executable can be used to open the app in default browser even if its not started (-open without -run)
	// used for shortcuts in start menu when installed on Windows systems with desktop experience
	// if dynamic port is used, we cannot open app without starting it (port is not known)
	if cli.open && !cli.dynamicPort {
		protocol := "https"
		if cli.http {
			protocol = "http"
		}
		tools.OpenRessource(fmt.Sprintf("%s://localhost:%d", protocol, config.File.Web.Port), false)
	}

	// interactive, app only starts if to be run from console or when creating an admin user
	if service.Interactive() && !cli.run && cli.adminCreate == "" {
		return
	}

	// run() blocks until stop() is called
	if err := svc.Run(); err != nil {
		prg.logger.Error(err)
		return
	}
}

// Start() is called when service is being started
func (prg *program) Start(svc service.Service) error {

	if !service.Interactive() {
		prg.logger.Info("Starting service")
	} else {
		log.SetOutputCli(true)
	}
	go prg.execute(svc)
	return nil
}

// execute the application logic
func (prg *program) execute(svc service.Service) {

	// stop service when main execution function returns
	defer func() {
		if service.Interactive() {
			// interactive session, not triggered by service manager, stop program
			if err := prg.Stop(svc); err != nil {
				prg.logger.Error(err)
			}
		} else {
			// triggered by service manager, stop service
			if err := svc.Stop(); err != nil {
				prg.logger.Error(err)
			}
		}
	}()

	// start embedded database
	if config.File.Db.Embedded {
		prg.logger.Infof("start embedded database at '%s'", config.File.Paths.EmbeddedDbData)
		embedded.SetPaths()

		if err := embedded.Start(); err != nil {
			prg.logger.Errorf("failed to start embedded database, %v", err)
			return
		}

		// we own the embedded DB if we can successfully start it
		// otherwise another instance might be running it
		prg.embeddedDbOwned = true
	}

	// connect to database
	// wait X seconds at first start for database service to become ready
	if err := db.OpenWait(15, config.File.Db); err != nil {
		prg.logger.Errorf("failed to open database connection, %v", err)
		return
	}

	// check for first database start
	if err := initialize.PrepareDbIfNew(); err != nil {
		prg.logger.Errorf("failed to initiate database on first start, %v", err)
		return
	}

	// load configuration from database
	if err := config.LoadFromDb(); err != nil {
		prg.logger.Errorf("failed to read configuration from database, %v", err)
		return
	}

	// set log levels from configuration
	config.SetLogLevels()

	// process cli commands
	if prg.cli.adminCreate != "" {
		adminInputs := strings.Split(prg.cli.adminCreate, ":")

		if len(adminInputs) != 2 {
			prg.logger.Errorf("invalid syntax for admin creation, required is username:password")
		} else {
			if err := login.CreateAdmin(adminInputs[0], adminInputs[1]); err != nil {
				prg.logger.Errorf("failed to create admin user, %v", err)
			} else {
				prg.logger.Info("successfully created new admin user")
			}
		}
		return
	}

	// run automatic database upgrade if required
	if err := upgrade.RunIfRequired(); err != nil {
		prg.logger.Errorf("failed automatic upgrade of database, %v", err)
		return
	}

	// initialize module schema cache
	if err := cache.UpdateSchemaAll(false); err != nil {
		prg.logger.Errorf("failed to initialize schema cache, %v", err)
		return
	}

	// initialize LDAP cache
	if err := cache.LoadLdapMap(); err != nil {
		prg.logger.Errorf("failed to initialize LDAP cache, %v", err)
		return
	}

	// initialize mail account cache
	if err := cache.LoadMailAccountMap(); err != nil {
		prg.logger.Errorf("failed to initialize mail account cache, %v", err)
		return
	}

	// process token secret for future client authentication from database
	if err := config.ProcessTokenSecret(); err != nil {
		prg.logger.Errorf("failed to process token secret, %v", err)
		return
	}

	// set unique instance ID if empty
	if err := config.SetInstanceIdIfEmpty(); err != nil {
		prg.logger.Errorf("failed to set instance ID, %v", err)
		return
	}

	log.Info("server", fmt.Sprintf("is ready to start application (%s)", appVersion))

	// apply configuration parameters
	bruteforce.SetConfig()
	activation.SetLicense()

	// start scheduler
	if err := scheduler.Start(); err != nil {
		prg.logger.Errorf("failed to start scheduler, %v", err)
		return
	}

	// prepare web server
	go websocket.StartBackgroundTasks()

	mux := http.NewServeMux()

	if prg.cli.wwwPath == "" {
		fsStaticWww, err := fs.Sub(fs.FS(fsStatic), "www")
		if err != nil {
			prg.logger.Errorf("failed to access embedded web file directory, %v", err)
			return
		}
		mux.Handle("/", http.FileServer(http.FS(fsStaticWww)))
	} else {
		mux.Handle("/", http.FileServer(http.Dir(prg.cli.wwwPath)))
	}

	mux.HandleFunc("/cache/download/", cache_download.Handler)
	mux.HandleFunc("/csv/download/", csv_download.Handler)
	mux.HandleFunc("/csv/upload", csv_upload.Handler)
	mux.HandleFunc("/data/access", data_access.Handler)
	mux.HandleFunc("/data/auth", data_auth.Handler)
	mux.HandleFunc("/data/download/", data_download.Handler)
	mux.HandleFunc("/data/upload", data_upload.Handler)
	mux.HandleFunc("/icon/upload", icon_upload.Handler)
	mux.HandleFunc("/ics/download/", ics_download.Handler)
	mux.HandleFunc("/license/upload", license_upload.Handler)
	mux.HandleFunc("/websocket", websocket.Handler)
	mux.HandleFunc("/export/", transfer_export.Handler)
	mux.HandleFunc("/import", transfer_import.Handler)

	webServerString := fmt.Sprintf("%s:%d", config.File.Web.Listen, config.File.Web.Port)
	webListener, err := net.Listen("tcp", webServerString)
	if err != nil {
		prg.logger.Errorf("failed to register listener for HTTP server, %v", err)
		return
	}
	config.File.Web.Port = webListener.Addr().(*net.TCPAddr).Port

	prg.webServer = &http.Server{
		Addr:              webServerString,
		Handler:           mux,
		IdleTimeout:       120 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Info("server", fmt.Sprintf("starting web handlers for '%s'", webServerString))

	// if dynamic port is used we can only now open the app in default browser (port is now known)
	if prg.cli.open && prg.cli.dynamicPort {
		protocol := "https"
		if prg.cli.http {
			protocol = "http"
		}
		tools.OpenRessource(fmt.Sprintf("%s://localhost:%d", protocol, config.File.Web.Port), false)
	}

	// start web server and block routine
	if prg.cli.http {
		if err := prg.webServer.Serve(webListener); err != nil && err != http.ErrServerClosed {
			prg.logger.Error(err)
		}
	} else {
		certPath := filepath.Join(config.File.Paths.Certificates, config.File.Web.Cert)
		keyPath := filepath.Join(config.File.Paths.Certificates, config.File.Web.Key)

		if err := cert.CreateIfNotExist(certPath, keyPath); err != nil {
			prg.logger.Error(err)
			return
		}
		if err := prg.webServer.ServeTLS(webListener, certPath, keyPath); err != nil && err != http.ErrServerClosed {
			prg.logger.Error(err)
		}
	}
}

// stop() is called when service is being shut down
func (prg *program) Stop(svc service.Service) error {

	if prg.stopping {
		return nil
	}
	prg.stopping = true

	// stop scheduler
	scheduler.Stop()

	// stop web server if running
	if prg.webServer != nil {

		ctx, cancelWeb := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelWeb()

		if err := prg.webServer.Shutdown(ctx); err != nil {
			prg.logger.Error(err)
		}
		log.Info("server", "stopped web handlers")
	}

	// close database connection if open
	if db.Pool != nil {
		db.Close()
		log.Info("server", "stopped database handler")
	}

	// stop embedded database if owned
	if prg.embeddedDbOwned {
		if err := embedded.Stop(); err != nil {
			prg.logger.Error(err)
		}
		log.Info("server", "stopped embedded database")
	}

	// interactive session, os.Exit must be called to properly shutdown program
	if service.Interactive() {
		os.Exit(0)
	}
	return nil
}
