// 導入模組
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { writeFile, createReadStream } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 導入 Cache function
import {
  getUserDetailInfo,
  getMatchTagTitles,
  getAllCandidateFromCache,
  getCandidateInfoFromCache,
  getAllPursuerFromCache,
  getPursuerFromCache,
} from "./models/user_model.js";

import { getDetailInfo } from "./controllers/user_controller.js";

import {
  getWhoLikeMeOfSelf,
  saveWhoLikeMeOfOtherSide,
  deletePursuerOfUser,
  deleteCandidateOfUser,
  saveNeverMatchOfUser,
  savePartnerOfUser,
  getPartnerOfUser,
} from "./controllers/choice_controller.js";

// 導入 ElasticSearch function
import {
  initChatIndexOfES,
  saveChatRecordToES,
  searchKeywordFromES,
} from "./models/chat_record_model.js";

// 建立 SocketIO function
const connectToSocketIO = (webSrv) => {
  const io = new Server(webSrv);

  // 目前有幾條連線
  let count = 0;

  // 如何儲存哪個連線是誰
  let connections = {};

  // FIXME: 找到是誰傳訊息 (如何比遍歷更高效率)
  const getKeyByValue = (value) => {
    for (const userId in connections) {
      if (value === connections[userId].socket) {
        return userId;
      }
    }
  };

  // 監聽 SocketIO 的 connection 事件
  io.on("connection", (socket) => {
    count++;
    console.log(`One client has connected. 目前連線數: ${count}`);

    // 儲存連線者
    socket.on("online", async (user) => {
      const { id, name, update } = user;

      connections[id] = { name, socket };
      // console.log("connections", connections);

      console.log(`user id #${id} successfully connect.`);

      // 更新自己的 pursuer + candidate list
      const candidateListOfSelf = await getAllCandidateFromCache(id);
      const candidateIdListOfSelf = Object.keys(candidateListOfSelf);

      const pursuerListOfSelf = await getAllPursuerFromCache(id);
      const pursuerIdListOfSelf = Object.keys(pursuerListOfSelf);

      const integratedIdListOfSelf = pursuerIdListOfSelf.concat(
        candidateIdListOfSelf
      );

      const potentialInfoListOfSelf = [];
      for (const potentialId of integratedIdListOfSelf) {
        const potentialInfo = await getCandidateInfoFromCache(potentialId);
        const tags = await getMatchTagTitles(potentialId);
        potentialInfo.tags = tags;
        potentialInfoListOfSelf.push(potentialInfo);
      }

      // const response = { id, testCandidateInfo };
      const response = {
        id,
        potentialInfoList: potentialInfoListOfSelf,
      };

      // 新註冊者資訊，渲染到符合條件的其他使用者的「猜你會喜歡」
      if (update) {
        const { newUserId, otherUserIdsList } = update;

        for (const otherUserId of otherUserIdsList) {
          if (!(otherUserId in connections)) {
            continue;
          }

          // 更新對方的 pursuer + candidate list
          const candidateListOfOtherSide = await getAllCandidateFromCache(
            otherUserId
          );
          const candidateIdListOfOtherSide = Object.keys(
            candidateListOfOtherSide
          );

          const pursuerListOfOtherSide = await getAllPursuerFromCache(
            otherUserId
          );
          const pursuerIdListOfOtherSide = Object.keys(pursuerListOfOtherSide);

          const integratedIdListOfOtherSide = pursuerIdListOfOtherSide.concat(
            candidateIdListOfOtherSide
          );

          const potentialInfoListOfOtherSide = [];
          for (const potentialId of integratedIdListOfOtherSide) {
            const potentialInfo = await getCandidateInfoFromCache(potentialId);
            const tags = await getMatchTagTitles(potentialId);
            potentialInfo.tags = tags;
            potentialInfoListOfOtherSide.push(potentialInfo);
          }

          // 把新註冊者的資訊送回對方的前端
          const responseForOtherSide = {
            userId: otherUserId,
            newUserId,
            potentialInfoList: potentialInfoListOfOtherSide,
          };
          connections[otherUserId].socket.emit(
            "new-user-added",
            responseForOtherSide
          );
        }
      }

      // 告知使用者已成功連線
      socket.emit("user-connect", response);
    });

    // 監聽使用者按下 logo 並要求所有的 potential list
    socket.on("request-all-potential", async (userId) => {
      // 更新自己的 pursuer + candidate list
      const candidateListOfSelf = await getAllCandidateFromCache(userId);
      const candidateIdListOfSelf = Object.keys(candidateListOfSelf);

      const pursuerListOfSelf = await getAllPursuerFromCache(userId);
      const pursuerIdListOfSelf = Object.keys(pursuerListOfSelf);

      const integratedIdListOfSelf = pursuerIdListOfSelf.concat(
        candidateIdListOfSelf
      );

      const potentialInfoListOfSelf = [];
      for (const potentialId of integratedIdListOfSelf) {
        const potentialInfo = await getCandidateInfoFromCache(potentialId);
        const tags = await getMatchTagTitles(potentialId);
        potentialInfo.tags = tags;
        potentialInfoListOfSelf.push(potentialInfo);
      }

      const response = {
        potentialInfoList: potentialInfoListOfSelf,
      };

      socket.emit("response-all-potential", response);
    });

    // 監聽到使用者喜歡候選人 (和配對成功的 socket.emit 合併)
    socket.on("desired-candidate", async (msg) => {
      const { userId, userName, candidateId, candidateName } = msg;

      // 確認目前推薦者是否為使用者的 pursuer
      const isPursuer = await getWhoLikeMeOfSelf(userId, candidateId);
      if (!isPursuer) {
        // 對方尚未喜歡自己，把自己儲存到對方的 "who_like_me" 快取
        await saveWhoLikeMeOfOtherSide(candidateId, userId, userName);

        // 從快取把雙方的 "candidate" 刪除彼此
        await deleteCandidateOfUser(userId, candidateId);
        await deleteCandidateOfUser(candidateId, userId);

        // 存進雙方的 "never_match" 到快取
        await saveNeverMatchOfUser(userId, candidateId);
        await saveNeverMatchOfUser(candidateId, userId);

        // 更新自己的 candidate list
        const candidateListOfSelf = await getAllCandidateFromCache(userId);
        const candidateIdListOfSelf = Object.keys(candidateListOfSelf);
        const candidateInfoListOfSelf = [];
        for (const candidateId of candidateIdListOfSelf) {
          const candidateInfo = await getCandidateInfoFromCache(candidateId);
          const tags = await getMatchTagTitles(candidateId);
          candidateInfo.tags = tags;
          candidateInfoListOfSelf.push(candidateInfo);
        }

        // 把重新整理的名單再次送回給自己的前端
        const responseForSelf = {
          userId,
          candidateId,
          candidateName,
          candidateInfoList: candidateInfoListOfSelf,
        };
        socket.emit("success-send-like-signal", responseForSelf);

        // 當對方在線上，再傳送到對方前端
        if (candidateId in connections) {
          // 更新對方的 pursuer + candidate list
          const candidateListOfOtherSide = await getAllCandidateFromCache(
            candidateId
          );
          const candidateIdListOfOtherSide = Object.keys(
            candidateListOfOtherSide
          );

          const pursuerListOfOtherSide = await getAllPursuerFromCache(
            candidateId
          );
          const pursuerIdListOfOtherSide = Object.keys(pursuerListOfOtherSide);

          const integratedIdListOfOtherSide = pursuerIdListOfOtherSide.concat(
            candidateIdListOfOtherSide
          );

          const potentialInfoListOfOtherSide = [];
          for (const potentialId of integratedIdListOfOtherSide) {
            const potentialInfo = await getCandidateInfoFromCache(potentialId);
            const tags = await getMatchTagTitles(potentialId);
            potentialInfo.tags = tags;
            potentialInfoListOfOtherSide.push(potentialInfo);
          }

          // 把重新整理的名單送到對方的前端
          const responseForOtherSide = {
            userId: candidateId,
            pursuerId: userId,
            pursuerName: userName,
            potentialInfoList: potentialInfoListOfOtherSide,
          };
          connections[candidateId].socket.emit(
            "who-like-me",
            responseForOtherSide
          );
        }

        console.log(
          `userId#${userId}(${userName}) like userId#${candidateId}(${candidateName})`
        );
      } else {
        // 從 cache 把對方從自己的 "who_like_me" 刪除
        await deletePursuerOfUser(userId, candidateId);

        // 建立房間編號
        const roomId = uuidv4();

        // 在 ElasticSearch 建立對話紀錄 index
        const indexId = `chatrecord-${userId}-${candidateId}`;
        await initChatIndexOfES(indexId);

        // 加入 roomId, indexId, image 到 cache 的 "partners"
        const userDetailInfo = await getUserDetailInfo(userId);
        const partnerDetailInfo = await getUserDetailInfo(candidateId);
        await savePartnerOfUser(
          userId,
          candidateId,
          partnerDetailInfo.nick_name,
          `images/${partnerDetailInfo.main_image}`,
          roomId,
          indexId
        );
        await savePartnerOfUser(
          candidateId,
          userId,
          userDetailInfo.nick_name,
          `images/${userDetailInfo.main_image}`,
          roomId,
          indexId
        );

        // 更新自己的 potential list
        const candidateListOfSelf = await getAllCandidateFromCache(userId);
        const candidateIdListOfSelf = Object.keys(candidateListOfSelf);

        const pursuerListOfSelf = await getAllPursuerFromCache(userId);
        const pursuerIdListOfSelf = Object.keys(pursuerListOfSelf);

        const integratedIdListOfSelf = pursuerIdListOfSelf.concat(
          candidateIdListOfSelf
        );

        const potentialInfoListOfSelf = [];
        for (const potentialId of integratedIdListOfSelf) {
          const potentialInfo = await getCandidateInfoFromCache(potentialId);
          const tags = await getMatchTagTitles(potentialId);
          potentialInfo.tags = tags;
          potentialInfoListOfSelf.push(potentialInfo);
        }

        // 拿到 partner-detail-info (加上 indexId key)
        const partnerInfo = await getCandidateInfoFromCache(candidateId);
        partnerInfo.indexId = indexId;

        const responseForSelf = {
          userId,
          partnerInfo,
          roomId,
          potentialInfoList: potentialInfoListOfSelf,
        };

        // 傳給自己
        socket.emit("success-match", responseForSelf);

        // 當對方在線上，才立即傳送資訊給對方
        if (candidateId in connections) {
          // 給對方自己的 detail-info (加上 indexId key)
          const selfInfo = await getCandidateInfoFromCache(userId);
          selfInfo.indexId = indexId;

          const responseForOtherSide = {
            userId: candidateId,
            partnerInfo: selfInfo,
            roomId,
          };

          // 傳給對方
          connections[candidateId].socket.emit(
            "success-be-matched",
            responseForOtherSide
          );
        }

        console.log(
          `Successfully match userId#${userId} with userId#${candidateId}`
        );
      }
    });

    // 監聽到使用者不喜歡被推薦的人
    socket.on("unlike", async (msg) => {
      const { userId, userName, unlikeId, unlikeName } = msg;
      const originPursuerListOfSelf = await getPursuerFromCache(userId);

      // 檢查被按不喜歡的人是否為 pursuer
      if (unlikeId in originPursuerListOfSelf) {
        // 從快取把對方從自己的 "pursuer" 刪除
        await deletePursuerOfUser(userId, unlikeId);

        // 更新自己的 pursuer + candidate list
        const candidateListOfSelf = await getAllCandidateFromCache(userId);
        const candidateIdListOfSelf = Object.keys(candidateListOfSelf);

        const pursuerListOfSelf = await getPursuerFromCache(userId);
        const pursuerIdListOfSelf = Object.keys(pursuerListOfSelf);

        const integratedIdListOfSelf = pursuerIdListOfSelf.concat(
          candidateIdListOfSelf
        );

        const potentialInfoListOfSelf = [];

        for (const potentialId of integratedIdListOfSelf) {
          const potentialInfo = await getCandidateInfoFromCache(potentialId);
          const tags = await getMatchTagTitles(potentialId);
          potentialInfo.tags = tags;
          potentialInfoListOfSelf.push(potentialInfo);
        }

        // 把重新整理的名單再次送回給自己的前端
        const responseForSelf = {
          userId,
          unlikeId,
          unlikeName,
          potentialInfoList: potentialInfoListOfSelf,
        };
        socket.emit("send-unlike-signal", responseForSelf);

        console.log(
          `userId#${userId}(${userName}) unlike userId#${unlikeId}(${unlikeName})`
        );
      } else {
        // 從快取把雙方的 "candidate" 刪除彼此
        await deleteCandidateOfUser(userId, unlikeId);
        await deleteCandidateOfUser(unlikeId, userId);

        // 存進雙方的 "never_match" 到快取
        await saveNeverMatchOfUser(userId, unlikeId);
        await saveNeverMatchOfUser(unlikeId, userId);

        // 更新自己的 candidate list
        const candidateListOfSelf = await getAllCandidateFromCache(userId);
        const candidateIdListOfSelf = Object.keys(candidateListOfSelf);
        const candidateInfoListOfSelf = [];
        for (const candidateId of candidateIdListOfSelf) {
          const candidateInfo = await getCandidateInfoFromCache(candidateId);
          const tags = await getMatchTagTitles(candidateId);
          candidateInfo.tags = tags;
          candidateInfoListOfSelf.push(candidateInfo);
        }

        // 把重新整理的名單再次送回給自己的前端
        const responseForSelf = {
          userId,
          unlikeId,
          unlikeName,
          potentialInfoList: candidateInfoListOfSelf,
        };
        socket.emit("send-unlike-signal", responseForSelf);

        console.log(
          `userId#${userId}(${userName}) unlike userId#${unlikeId}(${unlikeName})`
        );

        // 如果對方在線上，才立即傳送資訊給對方
        if (unlikeId in connections) {
          // 更新對方的 pursuer + candidate list
          const candidateListOfOtherSide = await getAllCandidateFromCache(
            unlikeId
          );
          const candidateIdListOfOtherSide = Object.keys(
            candidateListOfOtherSide
          );

          const pursuerListOfOtherSide = await getPursuerFromCache(unlikeId);
          const pursuerIdListOfOtherSide = Object.keys(pursuerListOfOtherSide);

          const potentialInfoListOfOtherSide = [];

          // 檢查被不喜歡者是否還有 pursuer
          if (!pursuerIdListOfOtherSide.length) {
            for (const potentialId of candidateIdListOfOtherSide) {
              const potentialInfo = await getCandidateInfoFromCache(
                potentialId
              );
              const tags = await getMatchTagTitles(potentialId);
              potentialInfo.tags = tags;
              potentialInfoListOfOtherSide.push(potentialInfo);
            }
          } else {
            const integratedIdListOfOtherSide = pursuerIdListOfOtherSide.concat(
              candidateIdListOfOtherSide
            );

            for (const potentialId of integratedIdListOfOtherSide) {
              const potentialInfo = await getCandidateInfoFromCache(
                potentialId
              );
              const tags = await getMatchTagTitles(potentialId);
              potentialInfo.tags = tags;
              potentialInfoListOfOtherSide.push(potentialInfo);
            }
          }

          // 把重新整理的名單送到對方的前端
          const responseForOtherSide = {
            userId: unlikeId,
            unlikeId: userId,
            unlikeName: userName,
            potentialInfoList: potentialInfoListOfOtherSide,
          };
          connections[unlikeId].socket.emit(
            "send-be-unlike-signal",
            responseForOtherSide
          );
        }
      }
    });

    // 監聽到使用者想要 partner 詳細資訊
    socket.on("ask-for-partner-info", async (partnerId) => {
      const response = await getDetailInfo(+partnerId);

      socket.emit("get-partner-info", response);
    });

    // 當有使用者想傳送訊息到聊天室
    socket.on("message", async (msg) => {
      const { partnerId, roomId, message } = msg;

      // FIXME: 改從前端拿 user id ??
      const userId = getKeyByValue(socket);
      const userName = connections[userId].name;

      // 把 user 和 partner 都加到這個 room id
      socket.join(roomId);

      // 如果對方有在線上，才把對方加入房間
      if (partnerId in connections) {
        connections[partnerId].socket.join(roomId);
      }

      // 傳送訊息時間
      const msOfTime = Date.now();
      const time = new Date();
      const timestamp = time.toLocaleString("en-US", {
        timeZone: "Asia/Taipei",
      });

      // 從快取的 "partner" 拿到 chat index
      const chatroomInfo = await getPartnerOfUser(userId, partnerId);
      const chatIndexId = chatroomInfo[3];

      try {
        // 把訊息存入 ES
        await saveChatRecordToES(
          chatIndexId,
          userId,
          userName,
          message,
          timestamp,
          msOfTime
        );
      } catch (error) {
        console.error("cannot save message into ES:", error);
      }

      const response = { userId, roomId, userName, message, timestamp };

      io.to(roomId).emit("room-broadcast", response);
    });

    // 當使用者想傳照片到聊天室
    socket.on("upload", (msg) => {
      const { roomId, partnerId, file } = msg;
      console.log(file); // <Buffer 25 50 44 ...>

      // FIXME: save the content to the disk (上傳到 S3 ??)
      let filename = `${uuidv4()}.jpg`; // 自動編號照片名稱

      // 回覆的訊息格式
      const response = {};
      // FIXME: 改從前端拿 user id ??
      const userId = getKeyByValue(socket);
      const userName = connections[userId].name;

      response.userName = userName;
      response.userId = userId;

      writeFile(`public/uploads/${filename}`, msg.file, async (err) => {
        if (err) {
          response.error = `This picture cannot display.`;
          io.emit("wholeFile", response);
          console.log("writeFile fail, error:", err);
        } else {
          // FIXME: 讀取硬碟中的圖片 (解析度跑掉)
          console.log("__dirname", __dirname);
          const readStream = createReadStream(
            path.join(__dirname, `/public/uploads/${filename}`),
            {
              encoding: "binary",
            }
          );

          // 拼湊回照片
          let chunks = [];

          // 把 user 和 partner 都加到這個 room id
          socket.join(roomId);

          // 如果對方有在線上，才把對方加入房間
          if (partnerId in connections) {
            connections[partnerId].socket.join(roomId);
          }

          // 對聊天室傳送圖片
          readStream.on("readable", () => {
            console.log("Image loading");

            let chunk;
            while ((chunk = readStream.read()) !== null) {
              chunks.push(chunk);
              io.to(roomId).emit("file", chunk);
            }
          });

          // 顯示圖片
          readStream.on("end", async () => {
            console.log("Image loaded");
            response.status = "success";
            response.roomId = roomId;

            // 傳送訊息時間
            const msOfTime = Date.now();
            const time = new Date();
            const timestamp = time.toLocaleString("en-US", {
              timeZone: "Asia/Taipei",
            });

            // 從快取的 "partner" 拿到 chat index
            const chatroomInfo = await getPartnerOfUser(userId, partnerId);
            const chatIndexId = chatroomInfo[3];

            // 把照片檔名存進 ES
            await saveChatRecordToES(
              chatIndexId,
              userId,
              userName,
              `uploads/${filename}`,
              timestamp,
              msOfTime
            );

            response.timestamp = timestamp;
            response.msOfTime = msOfTime;
            io.to(roomId).emit("wholeFile", response);
          });
        }
      });
    });

    // 當使用者想要搜尋對話關鍵字
    socket.on("search", async (msg) => {
      const { userId, partnerId, keyword } = msg;

      // 從快取的 "partner" 拿到 chat index
      const chatroomInfo = await getPartnerOfUser(userId, partnerId);
      const chatIndexId = chatroomInfo[3];

      const result = await searchKeywordFromES(chatIndexId, keyword);
      socket.emit("search-result", result);
    });

    // FIXME: 監聽 client 是否已經斷開連線 (可做哪個使用者已離開)
    socket.on("disconnect", () => {
      count--;
      console.log(`One client has disconnected. 目前連線數: ${count}`);
    });
  });
};

export default connectToSocketIO;
