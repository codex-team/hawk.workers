# Network name should be default
# If you want to change it, check `docker network ls`
default_network="hawkmono_default"

help ()
{
  echo "Run example: ./run-in-docker.sh <worker_name>"
  echo "For rebuilding run: ./run-in-docker.sh --build"
  echo "Available workers:"
  sed -n -e 's/.*\(hawk-worker-[^"]*\).*/ -> \1/p' package.json
}

build ()
{
  echo "Building hawk-workers..."
  docker build -t hawk-workers .
}

if [[ "$(docker images -q hawk-workers 2> /dev/null)" == "" ]]; then
  echo "Not found docker image"
  build
fi

if [ "$#" -eq 0 ]; then
    help
fi

for arg in "$@"
do
    if [ "$arg" == "--help" ] || [ "$arg" == "-h" ]
    then help
    elif [ "$arg" == "--build" ]
    then build
    else
      docker run -d --network ${default_network} -v $(pwd)/.env:/app/.env --restart unless-stopped --entrypoint /usr/local/bin/node hawk-workers runner.js $arg
    fi
done
