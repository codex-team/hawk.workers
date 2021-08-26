#!/bin/sh

# Script help
if [[ "$1" =~ ^-h|--help$ ]] ; then
    echo "Usage: `basename $0` [-h] [-p|--path=<path>] [-t|--token=<string>] [-ce|--collectorEndpoint=<url>]
  -t  | --token             : Hawk integration token for your project
  -r  | --release           : Release name. Any string that will be associated with project events
  -ce | --collectorEndpoint : Endpoint to send release data. (optional)
"
    exit 0
fi

# Script arguments
for i in "$@"
do
case $i in
    -t=*|--token=*)
    token="${i#*=}"
    ;;

    -r=*|--release=*)
    release="${i#*=}"
    ;;

    -ce=*|--collectorEndpoint=*)
    collectorEndpoint="${i#*=}"
    ;;
esac
done

# Required fields
if [[ $release == "" ]]; then
    echo "Please, provide [--]release name so we can attach commits to this release"
    exit 0
fi

if [[ $token == "" ]]; then
    echo "Please, provide hawk integration [--]token. You can get it in the project integration settings"
    exit 0
fi

# Checking the git for availability
git --version 2>&1 >/dev/null
isGitAvailable=$?

# Collecting the last few commits
if [ $isGitAvailable -eq 0 ]; then
    commits=$(git --no-pager log --no-color --pretty="{\"hash\":\"%H\",\"title\":\"%s\",\"author\":\"%ae\",\"date\":\"%ad\"}@end@")
    lastCommits="[ "
    commitsCounter=0
    while [[ $commits ]] && [[ $commitsCounter -lt 5 ]] ; do
        if [[ $commits = *@end@* ]]; then
            first=${commits%%'@end@'*}
            rest=${commits#*'@end@'}
        else
            first=$commits
            rest=''
        fi

        let "commitsCounter+=1" 
        lastCommits="$lastCommits$first,"
        commits=$rest
    done
    lastCommits="${lastCommits:0:${#lastCommits}-1}]"
else
    echo "Could not find the 'git' command on the machine. You have to install it in order to send commits for release"
    exit 0
fi

# Create endpoint name
if [[ $collectorEndpoint == "" ]]; then
    collectorEndpoint="https://k1.hawk.so/release"
    parsedToken=`echo $token | base64 --decode`
    integrationId=`echo $parsedToken | awk -F '\"' '{print $4}'`

    if [[ $token != "" ]]; then
        collectorEndpoint="https://$integrationId.k1.hawk.so/release"
    fi
fi

# Colors
CYAN='\033[1;36m'
GREEN='\033[1;32m'
BLUE='\033[1;34m'
NO_COLOR='\033[0m'

echo "${CYAN}Sending ${GREEN}$commitsCounter${CYAN} commits for the ${GREEN}'$release'${CYAN} release to ${BLUE}$collectorEndpoint${NO_COLOR}"

# Send request to the collector
curl --request POST -F release="$release" -F commits="$lastCommits" ${collectorEndpoint} -H "Authorization: Bearer $token"

echo