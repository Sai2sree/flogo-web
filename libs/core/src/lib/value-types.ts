export enum ValueType {
  String = 'string',
  Integer = 'integer',
  Long = 'long',
  Double = 'double',
  Boolean = 'boolean',
  Object = 'object',
  Array = 'array',
  Any = 'any',
  Params = 'params',
  Bytes = 'bytes',
}

const _allTypes: ReadonlyArray<ValueType> = Object.values(ValueType);
const _defaultValuesForValueTypes: [ValueType, any][] = [
  [ValueType.String, ''],
  [ValueType.Integer, 0],
  [ValueType.Long, 0],
  [ValueType.Double, 0.0],
  [ValueType.Boolean, false],
  [ValueType.Object, null],
  [ValueType.Array, []],
  [ValueType.Params, null],
  [ValueType.Any, null],
  [ValueType.Bytes, ''],
];
export namespace ValueType {
  export const allTypes = _allTypes;
  export const defaultValueForType = new Map<ValueType, any>(_defaultValuesForValueTypes);
}
