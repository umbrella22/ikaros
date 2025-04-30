import axios from 'axios'

export const axiosInst = axios.create({
  baseURL: '/gw',
  timeout: 10000,
})

/** 抽取data */
const request = async (params) => {
  return axiosInst(params).then((res) => {
    return res.data
  })
}

export default request
