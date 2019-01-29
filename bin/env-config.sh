# For TRAVIS
# Copies files with environment variables from .env.sample at .env 
# for all subfolders where it is exist
# (can not use --execdir in travis https://github.com/travis-ci/travis-ci/issues/2811)

function pathedit {
  str=$0
  len=${#envfile}
  str=${str:0:((-$len))}
  cp $0 "$str.env"
}

export -f pathedit
declare -x envfile=".env.sample"

find . -path ./node_modules -prune -o -name $envfile -exec bash -c "pathedit $0" {} \;