import { Verb as VerbType } from './constants';

import {
  fromObject,
  getTable,
  joinKeys,
  joinValues,
  orderbyKeys,
  toObject
} from './util';

import {
  Expr,
  ExprList,
  ExprNumber,
  ExprObject,
  JoinKeys,
  JoinValues,
  Options,
  OrderbyKeys,
  SelectionList,
  TableRef,
  TableRefList
} from './constants';

import toAST from './to-ast';

/**
 * Model an Arquero verb as a serializable object.
 */
export class Verb {

  /**
   * Construct a new verb instance.
   * @param {string} verb The verb name.
   * @param {object[]} schema Schema describing verb parameters.
   * @param {any[]} params Array of parameter values.
   */
  constructor(verb, schema = [], params = []) {
    this.verb = verb;
    this.schema = schema;
    schema.forEach((s, index) => {
      const type = s.type;
      const param = params[index];
      const value = type === JoinKeys ? joinKeys(param)
        : type === JoinValues ? joinValues(param)
        : type === OrderbyKeys ? orderbyKeys(param)
        : param;
      this[s.name] = value !== undefined ? value : s.default;
    });
  }

  /**
   * Create new verb instance from the given serialized object.
   * @param {object} object A serialized verb representation, such as
   *  those generated by Verb.toObject.
   * @returns {Verb} The instantiated verb.
   */
  static from(object) {
    const verb = Verbs[object.verb];
    const params = (verb.schema || [])
      .map(({ name }) => fromObject(object[name]));
    return verb(...params);
  }

  /**
   * Evaluate this verb against a given table and catalog.
   * @param {Table} table The Arquero table to process.
   * @param {Function} catalog A table lookup function that accepts a table
   *  name string as input and returns a corresponding Arquero table.
   * @returns {Table} The resulting Arquero table.
   */
  evaluate(table, catalog) {
    const params = this.schema.map(({ name, type }) => {
      const value = this[name];
      return type === TableRef ? getTable(catalog, value)
        : type === TableRefList ? value.map(t => getTable(catalog, t))
        : value;
    });
    return table[this.verb](...params);
  }

  /**
   * Serialize this verb as a JSON-compatible object. The resulting
   * object can be passed to Verb.from to re-instantiate this verb.
   * @returns {object} A JSON-compatible object representing this verb.
   */
  toObject() {
    const obj = { verb: this.verb };
    this.schema.forEach(({ name }) => {
      obj[name] = toObject(this[name]);
    });
    return obj;
  }

  /**
   * Serialize this verb to a JSON-compatible abstract syntax tree.
   * All table expressions will be parsed and represented as AST instances
   * using a modified form of the Mozilla JavaScript AST format.
   * This method can be used to output parsed and serialized representations
   * to translate Arquero verbs to alternative data processing platforms.
   * @returns {object} A JSON-compatible abstract syntax tree object.
   */
  toAST() {
    const obj = { type: VerbType, verb: this.verb };
    this.schema.forEach(({ name, type, props }) => {
      obj[name] = toAST(this[name], type, props);
    });
    return obj;
  }
}

/**
 * Verb parameter type.
 * @typedef {Expr|ExprList|ExprNumber|ExprObject|JoinKeys|JoinValues|Options|OrderbyKeys|SelectionList|TableRef|TableRefList} ParamType
 */

/**
 * Verb parameter schema.
 * @typedef {object} ParamDef
 * @property {string} name The name of the parameter.
 * @property {ParamType} type The type of the parameter.
 * @property {{ [key: string]: ParamType }} [props] Types for non-literal properties.
 */

/**
 * Create a new constructors.
 * @param {string} name The name of the verb.
 * @param {ParamDef[]} schema The verb parameter schema.
 * @return {Function} A verb constructor function.
 */
export function createVerb(name, schema) {
  return Object.assign(
    (...params) => new Verb(name, schema, params),
    { schema }
  );
}

/**
 * A lookup table of verb classes.
 */
export const Verbs = {
  count:      createVerb('count', [
                { name: 'options', type: Options }
              ]),
  derive:     createVerb('derive', [
                { name: 'values', type: ExprObject },
                { name: 'options', type: Options,
                  props: { before: SelectionList, after: SelectionList }
                }
              ]),
  filter:     createVerb('filter', [
                { name: 'criteria', type: ExprObject }
              ]),
  groupby:    createVerb('groupby', [
                { name: 'keys', type: ExprList }
              ]),
  orderby:    createVerb('orderby', [
                { name: 'keys', type: OrderbyKeys }
              ]),
  relocate:   createVerb('relocate', [
                { name: 'columns', type: SelectionList },
                { name: 'options', type: Options,
                  props: { before: SelectionList, after: SelectionList }
                }
              ]),
  rename:     createVerb('rename', [
                { name: 'columns', type: SelectionList }
              ]),
  rollup:     createVerb('rollup', [
                { name: 'values', type: ExprObject }
              ]),
  sample:     createVerb('sample', [
                { name: 'size', type: ExprNumber },
                { name: 'options', type: Options, props: { weight: Expr } }
              ]),
  select:     createVerb('select', [
                { name: 'columns', type: SelectionList }
              ]),
  ungroup:    createVerb('ungroup'),
  unorder:    createVerb('unorder'),
  reify:      createVerb('reify'),
  dedupe:     createVerb('dedupe', [
                { name: 'keys', type: ExprList, default: [] }
              ]),
  impute:     createVerb('impute', [
                { name: 'values', type: ExprObject },
                { name: 'options', type: Options, props: { expand: ExprList } }
              ]),
  fold:       createVerb('fold', [
                { name: 'values', type: ExprList },
                { name: 'options', type: Options }
              ]),
  pivot:      createVerb('pivot', [
                { name: 'keys', type: ExprList },
                { name: 'values', type: ExprList },
                { name: 'options', type: Options }
              ]),
  spread:     createVerb('spread', [
                { name: 'values', type: ExprList },
                { name: 'options', type: Options }
              ]),
  unroll:     createVerb('unroll', [
                { name: 'values', type: ExprList },
                { name: 'options', type: Options, props: { drop: ExprList } }
              ]),
  lookup:     createVerb('lookup', [
                { name: 'table', type: TableRef },
                { name: 'on', type: JoinKeys },
                { name: 'values', type: ExprList }
              ]),
  join:       createVerb('join', [
                { name: 'table', type: TableRef },
                { name: 'on', type: JoinKeys },
                { name: 'values', type: JoinValues },
                { name: 'options', type: Options }
              ]),
  cross:      createVerb('cross', [
                { name: 'table', type: TableRef },
                { name: 'values', type: JoinValues },
                { name: 'options', type: Options }
              ]),
  semijoin:   createVerb('semijoin', [
                { name: 'table', type: TableRef },
                { name: 'on', type: JoinKeys }
              ]),
  antijoin:   createVerb('antijoin', [
                { name: 'table', type: TableRef },
                { name: 'on', type: JoinKeys }
              ]),
  concat:     createVerb('concat', [
                { name: 'tables', type: TableRefList }
              ]),
  union:      createVerb('union', [
                { name: 'tables', type: TableRefList }
              ]),
  intersect:  createVerb('intersect', [
                { name: 'tables', type: TableRefList }
              ]),
  except:     createVerb('except', [
                { name: 'tables', type: TableRefList }
              ])
};

/**
 * Abstract class representing a data table.
 * @typedef {import('../table/table').default} Table
 */
