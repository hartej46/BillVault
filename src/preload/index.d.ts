import { BillSortAPI } from '../shared/types'

declare global {
  interface Window {
    billsort: BillSortAPI
  }
}
