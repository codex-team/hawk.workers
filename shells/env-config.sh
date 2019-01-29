# For different .env files in each folders

function pathedit {
  str=$0
  len=${#envfile}
  str=${str:0:((-$len))}
  cp $0 "$str.env"
}

export -f pathedit
declare -x envfile=".env.sample"

find . -path ./node_modules -prune -o -name $envfile -exec bash -c "pathedit $0" {} \;