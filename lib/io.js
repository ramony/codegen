import fs from 'fs';
import yaml from 'js-yaml';

const io = {
  write(filePath, data) {
    fs.writeFileSync(filePath, data, 'utf8');
  },
  writeJSON(filePath, data, formatter) {
    this.write(filePath, JSON.stringify(data, '', formatter));
  },
  writeYAML(filePath, data) {
    this.write(filePath, yaml.dump(data));
  },
  read(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  },
  tryRead(filePath) {
    if (!exists(filePath)) {
      return [null, false]
    }
    return [this.read(filePath), true];
  },
  readJSON(filePath) {
    return JSON.parse(this.read(filePath));
  },
  tryReadJSON(filePath, initData) {
    if (!this.exists(filePath)) {
      if (initData != undefined) {
        this.writeJSON(filePath, initData);
      }
      return [null, false]
    }
    return [this.readJSON(filePath), true];
  },
  readYAML(filePath) {
    return yaml.load(this.read(filePath));
  },
  tryReadYAML(filePath, initData) {
    if (!this.exists(filePath)) {
      if (initData != undefined) {
        this.writeYAML(filePath, initData);
      }
      return [null, false]
    }
    return [this.readYAML(filePath), true];
  },
  exists(filePath) {
    return fs.existsSync(filePath)
  },
  mkdir(filePath) {
    fs.mkdirSync(filePath, { recursive: true });
  }
}

export default io