import sys
import os
import tarfile
import urllib.request
import signal

URL = "https://zenodo.org/api/records/15571083/files/mxl.tar.gz/content"
OUTPUT_DIR = "temp/pdmx_downloads"
TARGET_COUNT = 10

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    print(f"Connecting to {URL}...")
    
    # Open stream
    stream = urllib.request.urlopen(URL)
    
    # Open tarfile on stream (pipe mode)
    # mode='r|gz' allows reading a stream of gzip data
    try:
        with tarfile.open(fileobj=stream, mode='r|gz') as tar:
            count = 0
            for member in tar:
                if member.isfile() and (member.name.endswith('.mxl') or member.name.endswith('.musicxml')):
                    print(f"Extracting {member.name}...")
                    
                    # Extract file
                    # tar.extract(member, path=OUTPUT_DIR) # extracts with full path
                    
                    # We want flat structure if possible, or just accept path
                    # Let's extract to file manually to flatten
                    f = tar.extractfile(member)
                    if f:
                        filename = os.path.basename(member.name)
                        with open(os.path.join(OUTPUT_DIR, filename), 'wb') as out:
                            out.write(f.read())
                        
                        count += 1
                        if count >= TARGET_COUNT:
                            print("Target count reached. Stopping.")
                            break
                            
    except (tarfile.TarError, OSError, EOFError) as e:
        # Expected to fail when we cut the stream? 
        # Actually we just break and exit, the stream closes cleanly mostly
        print(f"Stopped or Error: {e}")

    print(f"Downloaded {len(os.listdir(OUTPUT_DIR))} files to {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
