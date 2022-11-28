import { registerAppEvent } from "../../private/playbackLoader.js";
import { genCombine } from "@proxtx/combine-rest/request.js";
import { genModule } from "@proxtx/combine/combine.js";
import fs from "fs/promises";
import hbjs from "handbrake-js";

export class App {
  updateCheckInterval = 1 * 60 * 1000;

  constructor(config) {
    this.config = config;
    (async () => {
      this.motionApi = await genCombine(
        this.config.apiUrl,
        "public/file.js",
        genModule
      );

      this.fileUrl = new URL(this.config.apiUrl);
      this.fileUrl.pathname = "/file.route/";

      this.mainUrl = new URL(this.config.apiUrl);
      this.mainUrl.pathname = "/";
      this.mainUrl = this.mainUrl.href;

      while (true) {
        (async () => {
          try {
            if (!config.disable) await this.checkForNewVids();
            await this.checkForOldFile();
          } catch (e) {
            console.log(e);
          }
        })();
        await new Promise((r) => setTimeout(r, this.updateCheckInterval));
      }
    })();
  }

  async checkForNewVids() {
    let file = await this.motionApi.newestFile(this.config.pwd);

    if (file && file.data.time > Date.now() - this.updateCheckInterval) {
      this.fileUrl.searchParams.set("perm", file.perm);

      await fs.writeFile(
        "temp.mkv",
        Buffer.from(await (await fetch(this.fileUrl.href)).arrayBuffer())
      );

      const options = {
        input: "temp.mkv",
        output: "temp.mp4",
      };

      await hbjs.run(options);

      let buffer = (await fs.readFile("temp.mp4")).toString("base64");

      await fs.unlink("temp.mkv");
      await fs.unlink("temp.mp4");

      registerAppEvent({
        app: "Motion",
        type: "Movement",
        text: `Motion detected movement. Filename: ${file.file}.`,
        media: [{ buffer, type: "video/mp4" }],
        open: this.mainUrl,
        time: file.data.time,
        points: this.config.points,
      });
    }
  }

  async checkForOldFile() {
    let file = await this.motionApi.nextIndexFile(this.config.pwd);
    if (file.data.time < Date.now() - 2 * 24 * 60 * 60 * 1000) {
      await this.motionApi.deleteFile(this.config.pwd, file.file);
    }
  }
}
