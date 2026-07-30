/**
 * 聊天功能模块入口
 */

export { createChatWindow, getChatWindow, showChat, hideChat, calcChatPosition } from './window'
export { startJokeIfDecompress, stopRandomJoke } from './ai-service'
export { setupChatIpc } from './ipc'
