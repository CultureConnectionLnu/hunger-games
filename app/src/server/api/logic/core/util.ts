
export type IfNotNever<Condition, True, False> = [Condition] extends [never]
  ? False
  : True;

export type CombineIfNotNever<T, K> = IfNotNever<
  T,
  IfNotNever<K, K & T, T>,
  IfNotNever<K, K, never>
>;

export type ToUnion<T> = T[keyof T];