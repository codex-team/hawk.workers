# Network name should be default
# If you want to change it, check `docker network ls`
default_network="hawkmono_default"

if [[ "$(docker images -q hawk-workers 2> /dev/null)" == "" ]]; then
  echo "Not found docker image. Building ..."
  docker build -t hawk-workers .
fi

help ()
{
    echo "Run example: ./run-in-docker.sh <worker_name>"
    echo "Available workers:"
    sed -n -e 's/.*\(hawk-worker-[^"]*\).*/ -> \1/p' package.json
}

if [ "$#" -eq 0 ]; then
    help
fi

for arg in "$@"
do
    if [ "$arg" == "--help" ] || [ "$arg" == "-h" ]
    then help
    else
      docker run --rm -d --network ${default_network} -v $(PWD)/.env:/app/.env --entrypoint /usr/local/bin/node hawk-workers runner.js $arg
    fi
done
