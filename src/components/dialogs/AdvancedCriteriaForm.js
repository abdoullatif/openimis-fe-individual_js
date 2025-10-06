/* eslint-disable max-len */
import React, { useEffect, useState } from 'react';
import { injectIntl } from 'react-intl';
import Button from '@material-ui/core/Button';
import { Divider, Grid, Paper } from '@material-ui/core';
import {
  decodeId,
  formatMessage,
  formatMessageWithValues,
  fetchCustomFilter,
  coreConfirm,
  clearConfirm,
} from '@openimis/fe-core';
import { withTheme, withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import AddCircle from '@material-ui/icons/Add';
import Typography from '@material-ui/core/Typography';
import AdvancedCriteriaRowValue from './AdvancedCriteriaRowValue';
import {
  CLEARED_STATE_FILTER,
  INDIVIDUAL,
  DEFAULT_BENEFICIARY_STATUS,
} from '../../constants';
import { isBase64Encoded, isEmptyObject } from '../../utils';
import { confirmEnrollment, fetchIndividualEnrollmentSummary } from '../../actions';
import IndividualPreviewEnrollmentDialog from './IndividualPreviewEnrollmentDialog';

const styles = (theme) => ({
  item: theme.paper.item,
});

function AdvancedCriteriaForm({
  intl,
  classes,
  object,
  objectToSave,
  fetchCustomFilter,
  customFilters,
  moduleName,
  objectType,
  setAppliedCustomFilters,
  appliedFiltersRowStructure,
  setAppliedFiltersRowStructure,
  updateAttributes,
  getDefaultAppliedCustomFilters,
  additionalParams,
  fetchIndividualEnrollmentSummary,
  enrollmentSummary,
  fetchedEnrollmentSummary,
  confirmEnrollment,
  confirmed,
  clearConfirm,
  coreConfirm,
  rights,
  edited,
}) {
  const [currentFilter, setCurrentFilter] = useState(CLEARED_STATE_FILTER);
  const [filters, setFilters] = useState(getDefaultAppliedCustomFilters());
  const [filtersToApply, setFiltersToApply] = useState(null);
  const status = edited?.status;

  /** Récupération du jeu de critères par défaut pour le plan courant */
  const getBenefitPlanDefaultCriteria = () => {
    const jsonExt = edited?.benefitPlan?.jsonExt ?? '{}';
    const jsonData = JSON.parse(jsonExt);
    let criteria = jsonData?.advanced_criteria || {};
    if (Array.isArray(criteria)) criteria = { [DEFAULT_BENEFICIARY_STATUS]: criteria };
    return criteria[status] || [];
  };

  useEffect(() => {
    const defaults = getDefaultAppliedCustomFilters();
    setFilters(defaults.length ? defaults : getBenefitPlanDefaultCriteria());
  }, [edited]);

  /** Construction des paramètres du fetch */
  const createParams = (moduleName, objectTypeName, uuidOfObject = null, additionalParams = null) => {
    const params = [
      `moduleName: "${moduleName}"`,
      `objectTypeName: "${objectTypeName}"`,
    ];
    if (uuidOfObject) params.push(`uuidOfObject: "${uuidOfObject}"`);
    if (additionalParams) params.push(`additionalParams: ${JSON.stringify(JSON.stringify(additionalParams))}`);
    return params;
  };

  const fetchFilters = (params) => fetchCustomFilter(params);

  const handleClose = () => setCurrentFilter(CLEARED_STATE_FILTER);
  const handleAddFilter = () => setFilters([...filters, CLEARED_STATE_FILTER]);
  const handleRemoveFilter = () => {
    setFilters([CLEARED_STATE_FILTER]);
    setAppliedFiltersRowStructure([CLEARED_STATE_FILTER]);
  };

  /** Met à jour le jsonExt avec les filtres sauvegardés */
  const updateJsonExt = (inputJsonExt, outputFilters) => {
    const existingData = JSON.parse(inputJsonExt || '{}');
    const filterData = JSON.parse(outputFilters);
    const advancedCriteria = existingData?.advanced_criteria || {};
    existingData.advanced_criteria = { ...advancedCriteria, [status]: filterData };
    return JSON.stringify(existingData);
  };

  /** Sauvegarde des critères */
  const saveCriteria = () => {
    setAppliedFiltersRowStructure(filters);

    // sérialisation robuste (gestion objets / string)
    const outputFilters = JSON.stringify(
      filters.map(({ filter, value, field, type, referential, typeLocation, amount }) => {
        const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
        return {
          amount,
          field,
          filter,
          type,
          referential,
          typeLocation,
          custom_filter_condition: `${field}__${filter}__${type}=${serializedValue}`,
          value: serializedValue,
        };
      }),
    );

    const jsonExt = updateJsonExt(objectToSave.jsonExt, outputFilters);
    updateAttributes(jsonExt);
    setAppliedCustomFilters(outputFilters);

    // Application sur le résumé d’enrôlement
    const jsonData = JSON.parse(jsonExt);
    const advancedCriteria = jsonData.advanced_criteria?.[status] || [];
    const customFiltersList = advancedCriteria.map((c) => `"${c.custom_filter_condition}"`);

    setFiltersToApply(customFiltersList);
    const params = [
      `customFilters: [${customFiltersList}]`,
      `benefitPlanId: "${decodeId(object.id)}"`,
    ];
    fetchIndividualEnrollmentSummary(params);
    handleClose();
  };

  /** Chargement des filtres custom disponibles */
  useEffect(() => {
    if (object && !isEmptyObject(object)) {
      const params = createParams(
        moduleName,
        objectType,
        isBase64Encoded(object.id) ? decodeId(object.id) : object.id,
        additionalParams,
      );
      fetchFilters(params);
    }
  }, [object]);

  /** Confirmation d'enrôlement */
  const openConfirmEnrollmentDialog = () => {
    coreConfirm(
      formatMessage(intl, 'individual', 'individual.enrollment.confirmTitle'),
      formatMessageWithValues(intl, 'individual', 'individual.enrollment.confirmMessageDialog', {
        benefitPlanName: object.name,
      }),
    );
  };

  /** Exécution après validation de la confirmation */
  useEffect(() => {
    if (confirmed) {
      const outputFilters = JSON.stringify(
        filters.map(({ filter, value, field, type }) => ({
          custom_filter_condition: `${field}__${filter}__${type}=${typeof value === 'object' ? JSON.stringify(value) : value}`,
        })),
      );
      const jsonExt = updateJsonExt(objectToSave.jsonExt, outputFilters);
      const jsonData = JSON.parse(jsonExt);
      const advancedCriteria = jsonData.advanced_criteria?.[status] || [];
      const customFiltersList = advancedCriteria.map((c) => `"${c.custom_filter_condition}"`);

      const params = {
        customFilters: `[${customFiltersList}]`,
        benefitPlanId: `"${decodeId(object.id)}"`,
        status: `"${status}"`,
      };
      confirmEnrollment(params, formatMessage(intl, 'individual', 'individual.enrollment.mutationLabel'));
    }
    return () => confirmed && clearConfirm(false);
  }, [confirmed]);

  return (
    <>
      {filters.map((filter, index) => (
        <AdvancedCriteriaRowValue
          key={`filter-${index}`}
          customFilters={customFilters}
          currentFilter={filter}
          setCurrentFilter={setCurrentFilter}
          index={index}
          filters={filters}
          setFilters={setFilters}
          readOnly={confirmed}
        />
      ))}

      {!confirmed && (
        <div style={{ backgroundColor: '#DFEDEF', paddingLeft: '10px', paddingBottom: '10px' }}>
          <AddCircle
            style={{ border: 'thin solid', borderRadius: '40px', width: '16px', height: '16px' }}
            onClick={handleAddFilter}
            disabled={confirmed}
          />
          <Button
            onClick={handleAddFilter}
            variant="outlined"
            style={{ border: 0, marginBottom: '6px', fontSize: '0.8rem' }}
            disabled={confirmed}
          >
            {formatMessage(intl, 'individual', 'individual.enrollment.addFilters')}
          </Button>
        </div>
      )}

      <div>
        <div style={{ float: 'left' }}>
          <Button
            onClick={handleRemoveFilter}
            variant="outlined"
            style={{ border: 0 }}
            disabled={confirmed}
          >
            {formatMessage(intl, 'individual', 'individual.enrollment.clearAllFilters')}
          </Button>
        </div>
        <div style={{ float: 'right', paddingRight: '16px' }}>
          <Button
            onClick={saveCriteria}
            variant="contained"
            color="primary"
            autoFocus
            disabled={!object || confirmed}
          >
            {formatMessage(intl, 'individual', 'individual.enrollment.previewEnrollment')}
          </Button>
        </div>
      </div>

      <Divider />

      {fetchedEnrollmentSummary && (
        <div>
          <div className={classes.item}>
            {formatMessage(intl, 'individual', 'individual.enrollment.summary')}
          </div>
          <Divider />

          <Grid container spacing={2}>
            {[
              ['totalNumberOfIndividuals', 'totalNumberOfIndividuals'],
              ['numberOfSelectedIndividuals', 'numberOfSelectedIndividuals'],
              ['numberOfIndividualsAssignedToProgramme', 'numberOfIndividualsAssignedToProgramme'],
              ['numberOfIndividualsNotAssignedToProgramme', 'numberOfIndividualsNotAssignedToProgramme'],
              ['numberOfIndividualsAssignedToSelectedProgramme', 'numberOfIndividualsAssignedToSelectedProgramme'],
              ['numberOfIndividualsToUpload', 'numberOfIndividualsToUpload'],
            ].map(([key, label]) => (
              <Grid item xs={6} key={key}>
                <Paper elevation={3} style={{ padding: 20 }}>
                  <Typography variant="h6">
                    {formatMessage(intl, 'individual', `individual.enrollment.${label}`)}
                  </Typography>
                  <Typography variant="body1">
                    {enrollmentSummary[key]}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={5} />
            <Grid item xs={5}>
              <Button
                onClick={openConfirmEnrollmentDialog}
                variant="contained"
                color="primary"
                autoFocus
                disabled={!object || confirmed || enrollmentSummary.numberOfIndividualsToUpload === '0'}
              >
                {formatMessage(intl, 'individual', 'individual.enrollment.confirmEnrollment')}
              </Button>
              <IndividualPreviewEnrollmentDialog
                rights={rights}
                classes={classes}
                advancedCriteria={filtersToApply}
                benefitPlanToEnroll={object.id}
                enrollmentSummary={enrollmentSummary}
                confirmed={confirmed}
              />
            </Grid>
            <Grid item xs={5} />
          </Grid>
        </div>
      )}
    </>
  );
}

const mapStateToProps = (state) => ({
  rights: state.core.user?.i_user?.rights ?? [],
  confirmed: state.core.confirmed,
  fetchingCustomFilters: state.core.fetchingCustomFilters,
  fetchedCustomFilters: state.core.fetchedCustomFilters,
  customFilters: state.core.customFilters,
  fetchedEnrollmentSummary: state.individual.fetchedEnrollmentSummary,
  enrollmentSummary: state.individual.enrollmentSummary,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({
  fetchCustomFilter,
  fetchIndividualEnrollmentSummary,
  confirmEnrollment,
  clearConfirm,
  coreConfirm,
}, dispatch);

export default injectIntl(
  withTheme(withStyles(styles)(connect(mapStateToProps, mapDispatchToProps)(AdvancedCriteriaForm))),
);
