// express 불러오기
const express = require("express")

// Node.js HTTP 서버
const http = require("http")

// Socket.IO 서버
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

// 방별 화면 공유자의 socket.id 저장
const screenSharers = new Map()

// public 폴더 공개
app.use(express.static("public"))

io.on("connection", (socket) => {
  console.log("접속:", socket.id)

  // =========================================
  // 방 입장
  // =========================================
  socket.on("join-room", (receivedRoomId) => {
    const roomId = String(receivedRoomId || "").trim()

    if (!roomId) {
      socket.emit(
        "room-error",
        "방 이름을 입력하세요."
      )
      return
    }

    const room =
      io.sockets.adapter.rooms.get(roomId)

    const userCount = room ? room.size : 0

    console.log(
      "방 입장 요청:",
      roomId,
      "현재 인원:",
      userCount
    )

    // 1:1 방이므로 최대 2명
    if (userCount >= 2) {
      socket.emit(
        "room-error",
        "방이 가득 찼습니다."
      )
      return
    }

    // 방 입장
    socket.join(roomId)

    // 현재 소켓의 방 저장
    socket.data.roomId = roomId

    /*
     * 이미 상대방이 화면 공유 중이라면
     * 늦게 입장한 사용자에게 카드 표시 알림
     */
    const currentScreenSharer =
      screenSharers.get(roomId)

    if (
      currentScreenSharer &&
      currentScreenSharer !== socket.id
    ) {
      socket.emit("screen-share-started")
    }

    if (userCount === 0) {
      socket.emit("room-created")

      console.log("방 생성:", roomId)
    } else {
      socket.emit("room-joined")

      socket
        .to(roomId)
        .emit("peer-joined")

      console.log(
        "두 번째 사람 입장:",
        roomId
      )
    }
  })

  // =========================================
  // 일반 화상채팅 WebRTC 신호 전달
  // =========================================
  socket.on("offer", (offer) => {
    const roomId = socket.data.roomId

    if (!roomId) {
      return
    }

    socket.to(roomId).emit("offer", offer)
  })

  socket.on("answer", (answer) => {
    const roomId = socket.data.roomId

    if (!roomId) {
      return
    }

    socket.to(roomId).emit("answer", answer)
  })

  socket.on("ice-candidate", (candidate) => {
    const roomId = socket.data.roomId

    if (!roomId) {
      return
    }

    socket
      .to(roomId)
      .emit("ice-candidate", candidate)
  })

  // =========================================
  // 화면 공유 시작
  // =========================================
  socket.on("screen-share-started", () => {
    const roomId = socket.data.roomId

    if (!roomId) {
      return
    }

    // 현재 사용자를 이 방의 화면 공유자로 저장
    screenSharers.set(roomId, socket.id)

    console.log(
      "화면 공유 시작:",
      roomId,
      socket.id
    )

    // 같은 방의 상대방에게 카드 표시 알림
    socket
      .to(roomId)
      .emit("screen-share-started")
  })

  // =========================================
  // 화면 공유 시청 요청
  // =========================================
  socket.on("join-screen-share", () => {
    const roomId = socket.data.roomId

    if (!roomId) {
      return
    }

    const sharerId =
      screenSharers.get(roomId)

    if (!sharerId) {
      console.warn(
        "현재 화면 공유자가 없음:",
        roomId
      )

      socket.emit(
        "screen-share-unavailable"
      )
      return
    }

    console.log(
      "화면 공유 시청 요청:",
      socket.id,
      "→",
      sharerId
    )

    // 화면 공유자에게만 시청 요청 전달
    io
      .to(sharerId)
      .emit("screen-viewer-joined")
  })

  // =========================================
  // 화면 공유용 WebRTC 신호 전달
  // =========================================
  socket.on("screen-offer", (offer) => {
    const roomId = socket.data.roomId

    if (!roomId) {
      return
    }

    socket
      .to(roomId)
      .emit("screen-offer", offer)
  })

  socket.on("screen-answer", (answer) => {
    const roomId = socket.data.roomId

    if (!roomId) {
      return
    }

    socket
      .to(roomId)
      .emit("screen-answer", answer)
  })

  socket.on(
    "screen-ice-candidate",
    (candidate) => {
      const roomId = socket.data.roomId

      if (!roomId) {
        return
      }

      socket
        .to(roomId)
        .emit(
          "screen-ice-candidate",
          candidate
        )
    }
  )

  // =========================================
  // 화면 공유 종료
  // =========================================
  socket.on("screen-share-stopped", () => {
    const roomId = socket.data.roomId

    if (!roomId) {
      return
    }

    /*
     * 화면 공유를 시작한 사용자 본인이
     * 종료했을 때만 공유 상태 삭제
     */
    if (
      screenSharers.get(roomId) ===
      socket.id
    ) {
      screenSharers.delete(roomId)

      socket
        .to(roomId)
        .emit("screen-share-stopped")
    }

    console.log(
      "화면 공유 종료:",
      roomId,
      socket.id
    )
  })

  // =========================================
  // 방 나가기
  // =========================================
  socket.on("leave-room", () => {
    const roomId = socket.data.roomId

    if (!roomId) {
      return
    }

    // 나가는 사용자가 화면 공유자라면 공유 종료
    if (
      screenSharers.get(roomId) ===
      socket.id
    ) {
      screenSharers.delete(roomId)

      socket
        .to(roomId)
        .emit("screen-share-stopped")
    }

    // 상대방에게 퇴장 알림
    socket
      .to(roomId)
      .emit("peer-left")

    // Socket.IO 방 나가기
    socket.leave(roomId)

    // 방 정보 삭제
    delete socket.data.roomId

    console.log(
      "방 나감:",
      socket.id,
      roomId
    )
  })

  // =========================================
  // 연결 해제
  // =========================================
  socket.on("disconnect", () => {
    const roomId = socket.data.roomId

    if (roomId) {
      // 연결이 끊긴 사용자가 공유자라면 정리
      if (
        screenSharers.get(roomId) ===
        socket.id
      ) {
        screenSharers.delete(roomId)

        socket
          .to(roomId)
          .emit(
            "screen-share-stopped"
          )
      }

      socket
        .to(roomId)
        .emit("peer-left")
    }

    console.log("나감:", socket.id)
  })
})

// 서버 실행
server.listen(3000, () => {
  console.log(
    "서버 실행: http://localhost:3000"
  )
})