class Store {
  static instance: Store
  get rootDir() {
    return process.cwd()
  }
  static getInstance() {
    if (this.instance) {
      return this.instance
    }
    return (this.instance = new Store())
  }
}

export const store = Store.getInstance()
