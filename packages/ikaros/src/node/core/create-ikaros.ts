import {
  DefaultIkarosInstance,
  type CreateIkarosOptions,
  type IkarosInstance,
} from './ikaros-instance'

export async function createIkaros(
  options: CreateIkarosOptions,
): Promise<IkarosInstance> {
  return new DefaultIkarosInstance(options)
}
