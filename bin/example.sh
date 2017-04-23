#!/bin/bash
# Example curl

url=http://exampleurl.com
content=$(curl "{$url}" )
echo $content >> output.txt
