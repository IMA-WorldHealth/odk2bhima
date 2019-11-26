const db = require('../lib/db');
const uuid = require('uuid/v4');
const q = require('q');

module.exports.depot_movement = depot_movement;


/*
*
Expected data from ODK for stock movement
{
  "depotToName" : "Depot Principal", // provincial depot
  "depotFromName" : "Depot Secondaire", // health zone depot
  "date" : "2019-11-25",
  "lots" : ["VITAMINE-B", "QUININE-C"],
  "isExit" : 0
}
*
*/

async function depot_movement(req, res, next) {
  try {
    const data = req.body;
    const defaultUserId = 1;
    const defaultProjectId = 1;
    const defaultEnterpriseId = 1;

    const depotFrom = await db.one('SELECT uuid FROM depot where text=?', data.depotFromName);
    const depotTo = await db.one('SELECT uuid FROM depot where text=?', data.depotToName);

    const lots = await q.all(data.lots.map(l => {
      return db.one('SELECT uuid, unit_cost FROM lot where label = ?', l);
    }));
    
    const fluxId = data.isExit ? 8 : 2;
    // 8 to other depot, 2  from other depot

    let params = {
      flux_id : fluxId,
      is_exit : data.isExit,
      date : new Date(data.date),
      from_depot : depotFrom.uuid,
      to_depot : depotTo.uuid,
      description: 'Reception from ODK',
      lots : [],
    }

    lots.forEach(l => {
      params.lots.push({
        uuid: l.uuid,
        depot_uuid : depotTo.uuid,
        quantity: 1,
        unit_cost: l.unit_cost,
        is_exit : 0,
        flux_id : 2
      })
    })

    const document = {
      uuid : uuid(),
      date : new Date(data.date),
      user : defaultUserId,
    };

    const metadata = {
      project : defaultProjectId,
      enterprise : defaultEnterpriseId,
    };

    await depotMovement(document, params, metadata)
    res.status(201).json({ uuid : document.uuid });

  }catch(ex) {
    next(ex);
  }

}

/**
 * @function depotMovement
 * @description movement between depots
 */
function depotMovement(document, params) {
  let isWarehouse;
  const transaction = db.transaction();
  const parameters = params;
  const isExit = parameters.isExit ? 1 : 0;

  let record;

  parameters.entity_uuid = parameters.entity_uuid ? db.bid(parameters.entity_uuid) : null;

  const depotUuid = isExit ? db.bid(parameters.from_depot) : db.bid(parameters.to_depot);
  const entityUuid = isExit ? db.bid(parameters.to_depot) : db.bid(parameters.from_depot);
  const fluxId = parameters.flux_id;

  parameters.lots.forEach((lot) => {
    record = {
      depot_uuid : depotUuid,
      entity_uuid : entityUuid,
      is_exit : isExit,
      flux_id : fluxId,
      uuid : db.bid(uuid()),
      lot_uuid : db.bid(lot.uuid),
      document_uuid : db.bid(document.uuid),
      quantity : lot.quantity,
      unit_cost : lot.unit_cost,
      date : document.date,
      description : parameters.description,
      user_id : document.user,
    };

    transaction.addQuery('INSERT INTO stock_movement SET ?', [record]);

    isWarehouse = !!(parameters.from_depot_is_warehouse);

    // track distribution to other depot from a warehouse
    if (record.is_exit && isWarehouse) {
      const consumptionParams = [
        db.bid(lot.inventory_uuid), db.bid(parameters.from_depot), document.date, lot.quantity,
      ];
      transaction.addQuery('CALL ComputeStockConsumptionByDate(?, ?, ?, ?)', consumptionParams);
    }

  });

  return transaction.execute();
}
