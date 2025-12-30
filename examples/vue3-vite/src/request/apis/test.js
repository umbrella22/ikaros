import request from '../index'

/** get */
export const getUserInfo = (params) => {
  return request({
    method: 'GET',
    url: '/getUserInfo',
    params,
  })
}

/** post */
export const getTerminal = (data) => {
  return request({
    method: 'POST',
    url: '/getTerminal',
    data,
  })
}
