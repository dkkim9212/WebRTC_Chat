// 방별 화면 공유자의 socket.id를 저장
const screenSharers = new Map()

// 로비 채팅방과 WebRTC 방 이름이 충돌하지 않도록 접두사 사용
function createRtcRoomId(receivedRoomId) {
    const roomId = String(receivedRoomId || "").trim()

    if (!roomId) {
        return ""
    }

    return `rtc:${roomId}`
}

function getRtcRoomId(socket) {
    return socket.data.rtcRoomId
}

// 상대방에게 WebRTC 데이터를 전달하는 공통 함수
function sendToPeer(socket, eventName, data) {
    const roomId = getRtcRoomId(socket)

    if (!roomId) {
        return
    }

    socket.to(roomId).emit(eventName, data)
}

// 방 나가기 및 화면공유 정보 정리
function leaveRtcRoom(socket, notifyPeer = true) {
    const roomId = getRtcRoomId(socket)

    if (!roomId) {
        return
    }

    // 나가는 사용자가 화면 공유자라면 화면 공유 정보 삭제
    if (screenSharers.get(roomId) === socket.id) {
        screenSharers.delete(roomId)
        socket.to(roomId).emit("screen-share-stopped")
    }

    if (notifyPeer) {
        socket.to(roomId).emit("peer-left")
    }

    socket.leave(roomId)
    delete socket.data.rtcRoomId

    console.log("WebRTC 방 나감:", socket.id, roomId)
}

export function registerWebRTC(io, socket) {

    // =========================================
    // WebRTC 방 입장
    // =========================================
    socket.on("join-room", (receivedRoomId) => {
        const roomId = createRtcRoomId(receivedRoomId)

        if (!roomId) {
            socket.emit("room-error", "방 정보가 없습니다.")
            return
        }

        // 이미 다른 WebRTC 방에 들어가 있다면 기존 방 정리
        if (
            socket.data.rtcRoomId &&
            socket.data.rtcRoomId !== roomId
        ) {
            leaveRtcRoom(socket)
        }

        const room = io.sockets.adapter.rooms.get(roomId)
        const userCount = room ? room.size : 0

        console.log(
            "WebRTC 방 입장 요청:",
            roomId,
            "현재 인원:",
            userCount
        )

        // 1:1 화상채팅이므로 최대 2명
        if (userCount >= 2) {
            socket.emit("room-error", "방이 가득 찼습니다.")
            return
        }

        socket.join(roomId)
        socket.data.rtcRoomId = roomId

        // 상대방이 이미 화면 공유 중인지 확인
        const currentScreenSharer = screenSharers.get(roomId)

        if (
            currentScreenSharer &&
            currentScreenSharer !== socket.id
        ) {
            socket.emit("screen-share-started")
        }

        if (userCount === 0) {
            socket.emit("room-created")
            console.log("WebRTC 방 생성:", roomId)
        } else {
            socket.emit("room-joined")
            socket.to(roomId).emit("peer-joined")
            console.log("WebRTC 두 번째 사용자 입장:", roomId)
        }
    })

    // =========================================
    // 일반 화상채팅 시그널링
    // =========================================
    socket.on("offer", (offer) => {
        sendToPeer(socket, "offer", offer)
    })

    socket.on("answer", (answer) => {
        sendToPeer(socket, "answer", answer)
    })

    socket.on("ice-candidate", (candidate) => {
        sendToPeer(socket, "ice-candidate", candidate)
    })

    // =========================================
    // 화면 공유 시작
    // =========================================
    socket.on("screen-share-started", () => {
        const roomId = getRtcRoomId(socket)

        if (!roomId) {
            return
        }

        screenSharers.set(roomId, socket.id)

        socket.to(roomId).emit("screen-share-started")

        console.log(
            "화면 공유 시작:",
            roomId,
            socket.id
        )
    })

    // =========================================
    // 상대방이 공유 화면 시청 요청
    // =========================================
    socket.on("join-screen-share", () => {
        const roomId = getRtcRoomId(socket)

        if (!roomId) {
            return
        }

        const sharerId = screenSharers.get(roomId)

        if (!sharerId) {
            socket.emit("screen-share-unavailable")
            return
        }

        // 화면을 공유하는 사람에게만 전달
        io.to(sharerId).emit("screen-viewer-joined")
    })

    // =========================================
    // 화면 공유용 WebRTC 시그널링
    // =========================================
    socket.on("screen-offer", (offer) => {
        sendToPeer(socket, "screen-offer", offer)
    })

    socket.on("screen-answer", (answer) => {
        sendToPeer(socket, "screen-answer", answer)
    })

    socket.on("screen-ice-candidate", (candidate) => {
        sendToPeer(
            socket,
            "screen-ice-candidate",
            candidate
        )
    })

    // =========================================
    // 화면 공유 종료
    // =========================================
    socket.on("screen-share-stopped", () => {
        const roomId = getRtcRoomId(socket)

        if (!roomId) {
            return
        }

        if (screenSharers.get(roomId) === socket.id) {
            screenSharers.delete(roomId)
            socket.to(roomId).emit("screen-share-stopped")
        }

        console.log(
            "화면 공유 종료:",
            roomId,
            socket.id
        )
    })

    // =========================================
    // WebRTC 방 나가기
    // =========================================
    socket.on("leave-room", () => {
        leaveRtcRoom(socket)
    })

    // 실제 연결이 끊어지기 직전
    socket.on("disconnecting", () => {
        leaveRtcRoom(socket)
    })
}