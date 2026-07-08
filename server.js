// express 불러오기
// 웹 서버를 쉽게 만들 수 있게 도와주는 라이브러리
const express = require("express")

// Node.js 기본 http 모듈 불러오기
// Socket.IO를 붙이려면 express 앱을 http 서버로 감싸야 함
const http = require("http")

// Socket.IO 서버 기능 불러오기
// 실시간 통신, 방 입장, offer/answer 전달에 사용
const { Server } = require("socket.io")

// express 앱 생성
const app = express()

// express 앱을 기반으로 http 서버 생성
const server = http.createServer(app)

// http 서버에 Socket.IO 서버 연결
const io = new Server(server)

// public 폴더 안의 파일들을 브라우저에서 접근 가능하게 설정
// 예: public/index.html, public/app.js
app.use(express.static("public"))

// 클라이언트가 Socket.IO로 접속했을 때 실행됨
io.on("connection", (socket) => {
  // 접속한 사용자의 고유 socket id 출력
  console.log("접속:", socket.id)

  // 클라이언트가 join-room 이벤트를 보냈을 때 실행
  socket.on("join-room", (roomId) => {
    // roomId가 undefined/null이어도 안전하게 문자열로 바꾸고 공백 제거
    roomId = String(roomId || "").trim()

    // 방 이름이 비어 있으면 클라이언트에게 오류 메시지 전송
    if (!roomId) {
      socket.emit("room-error", "방 이름을 입력하세요.")
      return
    }

    // 현재 해당 방에 누가 있는지 확인
    const room = io.sockets.adapter.rooms.get(roomId)

    // 방이 있으면 현재 인원 수, 없으면 0명
    const userCount = room ? room.size : 0

    // 서버 터미널에 방 입장 요청 로그 출력
    console.log("방 입장 요청:", roomId, "현재 인원:", userCount)

    // 이 예제는 1:1 화상채팅이므로 2명 이상은 못 들어가게 막음
    if (userCount >= 2) {
      socket.emit("room-error", "방이 가득 찼습니다.")
      return
    }

    // 현재 사용자를 해당 roomId 방에 입장시킴
    socket.join(roomId)

    // 이 socket이 어느 방에 들어갔는지 저장
    // 나중에 offer, answer, ice-candidate 보낼 때 사용
    socket.data.roomId = roomId

    // 현재 방 인원이 0명이었다면 내가 첫 번째 입장자
    if (userCount === 0) {
      // 클라이언트에게 방이 생성되었다고 알림
      socket.emit("room-created")

      // 서버 터미널에 방 생성 로그 출력
      console.log("방 생성:", roomId)
    } else {
      // 현재 방 인원이 1명이었다면 내가 두 번째 입장자

      // 두 번째 입장자에게 방 입장 완료 이벤트 전송
      socket.emit("room-joined")

      // 기존에 방에 있던 첫 번째 사람에게 상대방이 들어왔다고 알림
      socket.to(roomId).emit("peer-joined")

      // 서버 터미널에 두 번째 사람 입장 로그 출력
      console.log("두 번째 사람 입장:", roomId)
      console.log("방 입장 요청:", roomId, "현재 인원:", userCount)
    }
  })

  // 클라이언트가 offer를 보냈을 때 실행
  socket.on("offer", (offer) => {
    // 현재 사용자가 들어간 방 이름 가져오기
    const roomId = socket.data.roomId

    // 같은 방에 있는 상대방에게 offer 전달
    socket.to(roomId).emit("offer", offer)
  })

  // 클라이언트가 answer를 보냈을 때 실행
  socket.on("answer", (answer) => {
    // 현재 사용자가 들어간 방 이름 가져오기
    const roomId = socket.data.roomId

    // 같은 방에 있는 상대방에게 answer 전달
    socket.to(roomId).emit("answer", answer)
  })

  // 클라이언트가 ICE Candidate를 보냈을 때 실행
  socket.on("ice-candidate", (candidate) => {
    // 현재 사용자가 들어간 방 이름 가져오기
    const roomId = socket.data.roomId

    // 같은 방에 있는 상대방에게 ICE Candidate 전달
    socket.to(roomId).emit("ice-candidate", candidate)
  })

  // 사용자가 브라우저를 닫거나 새로고침하거나 연결이 끊겼을 때 실행
  socket.on("disconnect", () => {
    // 사용자가 들어가 있던 방 이름 가져오기
    const roomId = socket.data.roomId

    // 방에 들어간 상태였다면
    if (roomId) {
      // 같은 방의 상대방에게 내가 나갔다고 알림
      socket.to(roomId).emit("peer-left")
    }

    // 서버 터미널에 나간 사람 socket id 출력
    console.log("나감:", socket.id)
  })
})

// 3000번 포트로 서버 실행
server.listen(3000, () => {
  console.log("서버 실행: http://localhost:3000")
})