import { IEngineService } from './base-service'

export class WebpackService extends IEngineService {
  serve(): Promise<void> {
    throw new Error('Method not implemented.')
  }
  build(): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
