## Node.js Framework

[![Build Status](http://drone.mikefarrow.co.uk/api/badge/github.com/weyforth/nodejs-framework/status.svg?branch=master)](http://drone.mikefarrow.co.uk/github.com/weyforth/nodejs-framework)

Docker based Node.js framework

### Prerequisites

You must have Docker and Docker Compose installed before beginning.

### Getting Started

* Clone this repo
* cd into the root of the repo and run:

```bash
tools/build
docker-compose up -d
```

The application should now be running on port 8080. If you're using boot2docker, run `boot2docker ip` to get the ip address of the virtual machine.

### Containers

This framework contains the following containers:
* **storage**: mounts a directory at `/storage`, this is meant to hold anything that should persist between deployments. Such as cache, uploaded files etc.
* **data**: mounts at `/data` and mirrors all the main application code. This data container is meant to be deleted every deployment, it's content replaced with the new application code.
* **node**: this is the main conainer that runs the application and contains the node.js binary.
* **buildtools**: is used to run NPM and any other build tools such as gulp which may be added in the future. This container is especially useful when simply building the application, such as during CI testing and deployment.



### Application types

There are two types of application you can build using this framework. One is a simple (for now) web server which by default listens on port 8080 for requests. The other is a simple worker application that will run the application at a specified interval. The worker mode can be enabled by uncommenting the first line of `index.js` and commenting out the rest of the file.

### Tools

NPM has a proxy script located in `tools`, which will run the correct docker-compose commands. For example, to update NPM dependencies, use:

```bash
tools/npm update
```
